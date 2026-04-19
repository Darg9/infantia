import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ScrapingCache } from '../cache';

// ── Mocks para Prisma (syncFromDb / saveToDb) ──────────────────────────────
// vi.hoisted() garantiza que los mocks existen antes del hoisting de vi.mock()
const { mockFindMany, mockUpsert, mockDisconnect } = vi.hoisted(() => ({
  mockFindMany:   vi.fn(),
  mockUpsert:     vi.fn(),
  mockDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn().mockImplementation(function () { return {}; }),
}));

vi.mock('../../../generated/prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(function () {
    return {
      scrapingCache: { findMany: mockFindMany, upsert: mockUpsert },
      $disconnect: mockDisconnect,
    };
  }),
}));

// Mock file system — tests no deben escribir archivos reales
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe('ScrapingCache', () => {
  let cache: ScrapingCache;

  beforeEach(() => {
    cache = new ScrapingCache();
  });

  describe('has()', () => {
    it('retorna false para URL no vista', () => {
      expect(cache.has('https://ejemplo.com/actividad')).toBe(false);
    });

    it('retorna true después de add()', () => {
      cache.add('https://ejemplo.com/actividad', 'Taller de arte');
      expect(cache.has('https://ejemplo.com/actividad')).toBe(true);
    });
  });

  describe('filterNew()', () => {
    it('devuelve todas las URLs cuando el cache está vacío', () => {
      const urls = ['https://a.com', 'https://b.com', 'https://c.com'];
      expect(cache.filterNew(urls)).toEqual(urls);
    });

    it('filtra URLs ya vistas', () => {
      cache.add('https://a.com', 'Actividad A');
      const urls = ['https://a.com', 'https://b.com', 'https://c.com'];
      expect(cache.filterNew(urls)).toEqual(['https://b.com', 'https://c.com']);
    });

    it('devuelve array vacío si todas ya están en cache', () => {
      cache.add('https://a.com', 'A');
      cache.add('https://b.com', 'B');
      expect(cache.filterNew(['https://a.com', 'https://b.com'])).toEqual([]);
    });

    it('devuelve array vacío con input vacío', () => {
      expect(cache.filterNew([])).toEqual([]);
    });
  });

  describe('size', () => {
    it('empieza en 0', () => {
      expect(cache.size).toBe(0);
    });

    it('incrementa con cada add()', () => {
      cache.add('https://a.com', 'A');
      cache.add('https://b.com', 'B');
      expect(cache.size).toBe(2);
    });

    it('no duplica entradas para la misma URL', () => {
      cache.add('https://a.com', 'Primera vez');
      cache.add('https://a.com', 'Segunda vez');
      expect(cache.size).toBe(1);
    });
  });

  describe('add()', () => {
    it('sobreescribe el título si la URL ya existe', () => {
      cache.add('https://a.com', 'Título original');
      cache.add('https://a.com', 'Título nuevo');
      // Sigue siendo 1 entrada
      expect(cache.size).toBe(1);
      // La URL sigue en cache
      expect(cache.has('https://a.com')).toBe(true);
    });
  });

  describe('save()', () => {
    it('llama writeFileSync al guardar', () => {
      const mockWrite = writeFileSync as MockedFunction<typeof writeFileSync>;
      cache.add('https://a.com', 'Actividad A');
      cache.save();
      expect(mockWrite).toHaveBeenCalledTimes(1);
    });

    it('serializa el contenido como JSON', () => {
      const mockWrite = writeFileSync as MockedFunction<typeof writeFileSync>;
      mockWrite.mockClear();
      cache.add('https://test.com', 'Test');
      cache.save();
      const contenido = mockWrite.mock.calls[0][1] as string;
      expect(() => JSON.parse(contenido)).not.toThrow();
      expect(contenido).toContain('https://test.com');
    });
  });

  describe('syncFromDb()', () => {
    beforeEach(() => {
      mockFindMany.mockReset();
      mockUpsert.mockReset();
    });

    it('no lanza si la BD devuelve entradas vacías', async () => {
      mockFindMany.mockResolvedValue([]);
      await expect(cache.syncFromDb()).resolves.toBeUndefined();
      expect(cache.size).toBe(0);
    });

    it('fusiona entradas nuevas de BD en el cache local', async () => {
      mockFindMany.mockResolvedValue([
        { url: 'https://bd.com/act1', title: 'Acto BD 1', scrapedAt: new Date() },
        { url: 'https://bd.com/act2', title: 'Acto BD 2', scrapedAt: new Date() },
      ]);
      await cache.syncFromDb();
      expect(cache.size).toBe(2);
      expect(cache.has('https://bd.com/act1')).toBe(true);
      expect(cache.has('https://bd.com/act2')).toBe(true);
    });

    it('no duplica URLs que ya están en el cache local', async () => {
      cache.add('https://local.com/act', 'Ya en disco');
      mockFindMany.mockResolvedValue([
        { url: 'https://local.com/act', title: 'También en BD', scrapedAt: new Date() },
        { url: 'https://bd.com/nueva', title: 'Solo en BD', scrapedAt: new Date() },
      ]);
      await cache.syncFromDb();
      expect(cache.size).toBe(2); // 1 local + 1 nueva de BD (no duplica)
    });

    it('maneja errores de BD sin lanzar (non-fatal)', async () => {
      mockFindMany.mockRejectedValue(new Error('DB connection failed'));
      await expect(cache.syncFromDb()).resolves.toBeUndefined();
    });
  });

  describe('saveToDb()', () => {
    beforeEach(() => {
      mockFindMany.mockReset();
      mockUpsert.mockReset();
    });

    it('no llama a Prisma si no hay entradas nuevas', async () => {
      await cache.saveToDb();
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('persiste entradas nuevas con upsert', async () => {
      mockUpsert.mockResolvedValue({});
      cache.add('https://nueva.com/act1', 'Actividad nueva');
      cache.add('https://nueva.com/act2', 'Otra actividad');
      await cache.saveToDb();
      expect(mockUpsert).toHaveBeenCalledTimes(2);
    });

    it('limpia newEntries después de guardar', async () => {
      mockUpsert.mockResolvedValue({});
      cache.add('https://nueva.com/act', 'Actividad');
      await cache.saveToDb();
      // Segunda llamada no debe hacer upsert — ya fue limpiado
      mockUpsert.mockClear();
      await cache.saveToDb();
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('maneja errores de BD sin lanzar (non-fatal)', async () => {
      mockUpsert.mockRejectedValue(new Error('DB write failed'));
      cache.add('https://nueva.com/act', 'Actividad');
      await expect(cache.saveToDb()).resolves.toBeUndefined();
    });
  });

  describe('load() desde archivo existente', () => {
    it('carga entradas desde archivo si existe', () => {
      const mockExists = existsSync as MockedFunction<typeof existsSync>;
      const mockRead = readFileSync as MockedFunction<typeof readFileSync>;
      const dataMock = JSON.stringify({
        entries: {
          'https://guardada.com': {
            url: 'https://guardada.com',
            title: 'Actividad guardada',
            scrapedAt: new Date().toISOString(),
          },
        },
      });
      mockExists.mockReturnValueOnce(true);
      mockRead.mockReturnValueOnce(dataMock as any);

      const cacheConArchivo = new ScrapingCache();
      expect(cacheConArchivo.has('https://guardada.com')).toBe(true);
      expect(cacheConArchivo.size).toBe(1);
    });

    it('retorna cache vacío si el archivo tiene JSON inválido', () => {
      const mockExists = existsSync as MockedFunction<typeof existsSync>;
      const mockRead = readFileSync as MockedFunction<typeof readFileSync>;
      mockExists.mockReturnValueOnce(true);
      mockRead.mockReturnValueOnce('json-invalido{{{' as any);

      const cacheRoto = new ScrapingCache();
      expect(cacheRoto.size).toBe(0);
    });
  });

  describe('filterSPI()', () => {
    const OLD  = '2024-01-01T00:00:00.000Z'; // lastmod anterior al scrape
    const NEW  = '2030-01-01T00:00:00.000Z'; // lastmod posterior al scrape (futuro)

    beforeEach(() => {
      // URL previamente scrapeada (scrapedAt ~ ahora)
      cache.add('https://a.com/evento', 'Evento A');
    });

    it('incluye URLs no vistas antes (primera vez)', () => {
      const { urls, spiSkipped } = cache.filterSPI([
        { url: 'https://nuevo.com/evento', lastmod: OLD },
      ]);
      expect(urls).toContain('https://nuevo.com/evento');
      expect(spiSkipped).toBe(0);
    });

    it('salta URL en cache sin lastmod (comportamiento conservador)', () => {
      const { urls, spiSkipped } = cache.filterSPI([
        { url: 'https://a.com/evento' }, // sin lastmod
      ]);
      expect(urls).toHaveLength(0);
      expect(spiSkipped).toBe(1);
    });

    it('salta URL en cache cuyo lastmod es anterior al scrape (sin cambios)', () => {
      const { urls, spiSkipped } = cache.filterSPI([
        { url: 'https://a.com/evento', lastmod: OLD },
      ]);
      expect(urls).toHaveLength(0);
      expect(spiSkipped).toBe(1);
    });

    it('incluye URL en cache cuyo lastmod es posterior al scrape (página actualizada)', () => {
      const { urls, spiSkipped } = cache.filterSPI([
        { url: 'https://a.com/evento', lastmod: NEW },
      ]);
      expect(urls).toContain('https://a.com/evento');
      expect(spiSkipped).toBe(0);
    });

    it('salta URL en cache con lastmod inválido (comportamiento conservador)', () => {
      const { urls, spiSkipped } = cache.filterSPI([
        { url: 'https://a.com/evento', lastmod: 'fecha-invalida' },
      ]);
      expect(urls).toHaveLength(0);
      expect(spiSkipped).toBe(1);
    });

    it('maneja mezcla correctamente', () => {
      cache.add('https://b.com/vieja', 'Vieja');
      const { urls, spiSkipped } = cache.filterSPI([
        { url: 'https://nueva.com/act',    lastmod: OLD }, // nueva → incluir
        { url: 'https://a.com/evento',     lastmod: OLD }, // cached + viejo → skip
        { url: 'https://b.com/vieja',      lastmod: NEW }, // cached + actualizado → incluir
        { url: 'https://c.com/sin-lastmod'            }, // nueva sin lastmod → incluir
      ]);
      expect(urls).toEqual([
        'https://nueva.com/act',
        'https://b.com/vieja',
        'https://c.com/sin-lastmod',
      ]);
      expect(spiSkipped).toBe(1);
    });

    it('devuelve todo vacío con input vacío', () => {
      const { urls, spiSkipped } = cache.filterSPI([]);
      expect(urls).toHaveLength(0);
      expect(spiSkipped).toBe(0);
    });
  });

  describe('needsReparse — marcado y helpers', () => {
    it('add() sin meta no marca needsReparse', () => {
      cache.add('https://a.com/act', 'Evento');
      expect(cache.isMarkedForReparse('https://a.com/act')).toBe(false);
    });

    it('add() con parserSource=gemini no marca needsReparse', () => {
      cache.add('https://a.com/act', 'Evento', undefined, { parserSource: 'gemini', confidenceScore: 0.85 });
      expect(cache.isMarkedForReparse('https://a.com/act')).toBe(false);
    });

    it('add() con fallback y score >= 0.5 no marca needsReparse', () => {
      cache.add('https://a.com/act', 'Evento', undefined, { parserSource: 'fallback', confidenceScore: 0.5 });
      expect(cache.isMarkedForReparse('https://a.com/act')).toBe(false);
    });

    it('add() con fallback y score < 0.5 marca needsReparse=true', () => {
      cache.add('https://a.com/act', 'Evento', undefined, { parserSource: 'fallback', confidenceScore: 0.42 });
      expect(cache.isMarkedForReparse('https://a.com/act')).toBe(true);
    });

    it('add() con fallback y score=0 marca needsReparse=true', () => {
      cache.add('https://a.com/act', 'Evento', undefined, { parserSource: 'fallback', confidenceScore: 0 });
      expect(cache.isMarkedForReparse('https://a.com/act')).toBe(true);
    });

    it('isMarkedForReparse() retorna false para URL no vista', () => {
      expect(cache.isMarkedForReparse('https://unknown.com')).toBe(false);
    });

    it('re-add() con gemini despues de fallback limpia needsReparse', () => {
      // Primera pasada: fallback bajo → marca needsReparse
      cache.add('https://a.com/act', 'Evento', undefined, { parserSource: 'fallback', confidenceScore: 0.3 });
      expect(cache.isMarkedForReparse('https://a.com/act')).toBe(true);
      // Segunda pasada: Gemini → limpia flag
      cache.add('https://a.com/act', 'Evento', undefined, { parserSource: 'gemini', confidenceScore: 0.9 });
      expect(cache.isMarkedForReparse('https://a.com/act')).toBe(false);
    });

    it('getReparseUrls() devuelve solo URLs marcadas', () => {
      cache.add('https://a.com/event1', 'E1', undefined, { parserSource: 'fallback', confidenceScore: 0.4 });
      cache.add('https://a.com/event2', 'E2', undefined, { parserSource: 'gemini',   confidenceScore: 0.9 });
      cache.add('https://a.com/event3', 'E3', undefined, { parserSource: 'fallback', confidenceScore: 0.2 });

      const candidates = ['https://a.com/event1', 'https://a.com/event2', 'https://a.com/event3'];
      const reparse = cache.getReparseUrls(candidates);

      expect(reparse).toContain('https://a.com/event1');
      expect(reparse).not.toContain('https://a.com/event2');
      expect(reparse).toContain('https://a.com/event3');
      expect(reparse).toHaveLength(2);
    });

    it('getReparseUrls() filtra candidatos no marcados', () => {
      cache.add('https://a.com/ok', 'OK', undefined, { parserSource: 'gemini', confidenceScore: 0.8 });
      expect(cache.getReparseUrls(['https://a.com/ok', 'https://nunca-vista.com'])).toHaveLength(0);
    });

    it('getReparseUrls() devuelve vacío con lista vacía', () => {
      expect(cache.getReparseUrls([])).toHaveLength(0);
    });
  });
});
