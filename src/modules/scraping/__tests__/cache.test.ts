import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ScrapingCache } from '../cache';

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
});
