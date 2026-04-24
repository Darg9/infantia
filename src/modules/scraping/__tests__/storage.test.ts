// =============================================================================
// Tests: modules/scraping/storage.ts
// Mockea Prisma completo — no toca la BD real
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ActivityNLPResult, BatchPipelineResult } from '../types';

// --- Mocks con vi.hoisted (deben estar listos antes del hoisting de vi.mock) ---
const mocks = vi.hoisted(() => {
  const mockVertical = { id: 'vert-001', slug: 'kids', name: 'Niños y Familia' };
  const mockProvider = { id: 'prov-001', name: 'biblored.gov.co' };
  const mockActivity = { id: 'act-001', title: 'Taller de arte' };

  return {
    mockVertical,
    mockProvider,
    mockActivity,
    mockVerticalFindUnique: vi.fn().mockResolvedValue(mockVertical),
    mockProviderFindFirst: vi.fn().mockResolvedValue(null),
    mockProviderUpsert: vi.fn().mockResolvedValue(mockProvider),
    mockActivityFindFirst: vi.fn().mockResolvedValue(null),
    mockActivityCreate: vi.fn().mockResolvedValue(mockActivity),
    mockActivityUpdate: vi.fn().mockResolvedValue(mockActivity),
    mockCategoryFindMany: vi.fn().mockResolvedValue([]),
    mockActivityCategoryUpsert: vi.fn().mockResolvedValue({}),
    mockProviderCreate: vi.fn().mockResolvedValue({ id: 'ig-new', name: '@nuevo' }),
    mockActivityFindMany: vi.fn().mockResolvedValue([]),
    mockDisconnect: vi.fn().mockResolvedValue(undefined),
    mockContentQualityMetricFindFirst: vi.fn().mockResolvedValue(null),
    mockSourceHealthFindMany: vi.fn().mockResolvedValue([]),
  };
});

// Mockeamos PrismaPg — debe ser una clase (no arrow function) para soportar 'new'
vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn().mockImplementation(function () { return {}; }),
}));

// Mockeamos PrismaClient — misma razón, debe ser función regular
vi.mock('../../../generated/prisma/client', () => ({
  Prisma: { JsonNull: '__JSON_NULL__' },
  // ActivityStatus debe estar en el mock: storage.ts lo importa para
  // asignar status ACTIVE / PAUSED según la decisión del publish-validator.
  // Sin esto, ActivityStatus.PAUSED = undefined.PAUSED → TypeError silencioso
  // que impide que prisma.activity.create se llame y rompe todos los tests.
  ActivityStatus: {
    ACTIVE: 'ACTIVE',
    PAUSED: 'PAUSED',
    DRAFT: 'DRAFT',
    DUPLICATE: 'DUPLICATE',
    EXPIRED: 'EXPIRED',
    DISCARDED_QUALITY: 'DISCARDED_QUALITY',
  },
  PrismaClient: vi.fn().mockImplementation(function () {
    return {
      vertical: { findUnique: mocks.mockVerticalFindUnique },
      provider: {
        upsert: mocks.mockProviderUpsert,
        findFirst: mocks.mockProviderFindFirst,
        create: mocks.mockProviderCreate,
      },
      activity: {
        findFirst: mocks.mockActivityFindFirst,
        findMany: mocks.mockActivityFindMany,
        create: mocks.mockActivityCreate,
        update: mocks.mockActivityUpdate,
      },
      category: { findMany: mocks.mockCategoryFindMany },
      activityCategory: { upsert: mocks.mockActivityCategoryUpsert },
      contentQualityMetric: { findFirst: mocks.mockContentQualityMetricFindFirst },
      sourceHealth: { findMany: mocks.mockSourceHealthFindMany },
      $disconnect: mocks.mockDisconnect,
    };
  }),
}));

vi.mock('dotenv/config', () => ({}));

import { ScrapingStorage } from '../storage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const actividadNLPBase: ActivityNLPResult = {
  isActivity: true,
  title: 'Taller de arte para niños',
  description: 'Taller creativo en el centro cultural para todas las edades garantizando diversión.',
  categories: ['Arte'],
  confidenceScore: 0.9,
  minAge: 6,
  maxAge: 12,
  price: 0,
  currency: 'COP',
  pricePeriod: null,
  schedules: [],
  location: null,
  audience: 'KIDS',
};

const makeBatchResult = (overrides: Partial<BatchPipelineResult['results'][0]>[] = []): BatchPipelineResult => ({
  sourceUrl: 'https://ejemplo.com',
  discoveredLinks: overrides.length,
  filteredLinks: overrides.length,
  results: overrides.map((o, i) => ({
    url: `https://ejemplo.com/actividad-${i}`,
    data: actividadNLPBase,
    ...o,
  })),
});

// ---------------------------------------------------------------------------

describe('ScrapingStorage.saveBatchResults()', () => {
  let storage: ScrapingStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    // Restaurar defaults
    mocks.mockVerticalFindUnique.mockResolvedValue(mocks.mockVertical);
    mocks.mockProviderFindFirst.mockResolvedValue(null);
    mocks.mockProviderUpsert.mockResolvedValue(mocks.mockProvider);
    mocks.mockActivityFindFirst.mockResolvedValue(null);
    mocks.mockActivityCreate.mockResolvedValue(mocks.mockActivity);
    mocks.mockActivityFindMany.mockResolvedValue([]);
    mocks.mockCategoryFindMany.mockResolvedValue([]);
    mocks.mockActivityCategoryUpsert.mockResolvedValue({});
    mocks.mockContentQualityMetricFindFirst.mockResolvedValue(null);
    mocks.mockSourceHealthFindMany.mockResolvedValue([]);
    storage = new ScrapingStorage();
  });

  it('retorna 0 saved con batch vacío', async () => {
    const result = await storage.saveBatchResults(makeBatchResult());
    expect(result.saved).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('omite items sin data (data null)', async () => {
    const batch = makeBatchResult([{ data: null }]);
    const result = await storage.saveBatchResults(batch);
    expect(result.skipped).toBe(1);
    expect(result.saved).toBe(0);
  });

  it('omite items Gemini con confidenceScore < 0.3 (nuevo threshold)', async () => {
    const batch = makeBatchResult([
      { data: { ...actividadNLPBase, confidenceScore: 0.25 } },  // sin parserSource → umbral Gemini 0.3
    ]);
    const result = await storage.saveBatchResults(batch);
    expect(result.skipped).toBe(1);
    expect(result.saved).toBe(0);
  });

  it('guarda items Gemini con confidenceScore >= 0.3', async () => {
    const batch = makeBatchResult([
      { data: { ...actividadNLPBase, confidenceScore: 0.3 } },
    ]);
    const result = await storage.saveBatchResults(batch);
    expect(result.saved).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('omite items fallback con confidenceScore < 0.5 (umbral más estricto)', async () => {
    const batch = makeBatchResult([
      { data: { ...actividadNLPBase, confidenceScore: 0.4, parserSource: 'fallback' } },
    ]);
    const result = await storage.saveBatchResults(batch);
    expect(result.skipped).toBe(1);
    expect(result.saved).toBe(0);
  });

  it('guarda items fallback con confidenceScore >= 0.5', async () => {
    const batch = makeBatchResult([
      { data: { ...actividadNLPBase, confidenceScore: 0.5, parserSource: 'fallback' } },
    ]);
    const result = await storage.saveBatchResults(batch);
    expect(result.saved).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('procesa mezcla de items válidos y omitidos', async () => {
    const batch = makeBatchResult([
      { data: { ...actividadNLPBase, confidenceScore: 0.9 } },   // guardado
      { data: null },                                             // omitido
      { data: { ...actividadNLPBase, confidenceScore: 0.1 } },   // omitido (baja confianza)
      { data: { ...actividadNLPBase, confidenceScore: 0.8 } },   // guardado
    ]);
    const result = await storage.saveBatchResults(batch);
    expect(result.saved).toBe(2);
    expect(result.skipped).toBe(2);
  });

  it('cuenta como error si saveActivity retorna null (vertical no encontrada)', async () => {
    mocks.mockVerticalFindUnique.mockResolvedValue(null); // sin vertical → error
    const batch = makeBatchResult([{ data: actividadNLPBase }]);
    const result = await storage.saveBatchResults(batch);
    expect(result.errors).toHaveLength(1);
    expect(result.saved).toBe(0);
  });

  it('usa upsert al guardar actividad ya existente', async () => {
    mocks.mockActivityFindFirst.mockResolvedValue({ id: 'existente-001' });
    const batch = makeBatchResult([{ data: actividadNLPBase }]);
    await storage.saveBatchResults(batch);
    expect(mocks.mockActivityUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.mockActivityCreate).not.toHaveBeenCalled();
  });

  it('crea actividad nueva si no existe en BD', async () => {
    mocks.mockActivityFindFirst.mockResolvedValue(null);
    const batch = makeBatchResult([{ data: actividadNLPBase }]);
    await storage.saveBatchResults(batch);
    expect(mocks.mockActivityCreate).toHaveBeenCalledTimes(1);
    expect(mocks.mockActivityUpdate).not.toHaveBeenCalled();
  });

  it('vincula categorías cuando hay match por nombre', async () => {
    const categoriasMock = [{ id: 'cat-001', name: 'Arte', verticalId: 'vert-001' }];
    mocks.mockCategoryFindMany.mockResolvedValue(categoriasMock);
    const batch = makeBatchResult([{
      data: { ...actividadNLPBase, categories: ['Arte', 'Música'] },
    }]);
    await storage.saveBatchResults(batch);
    // Arte hace match exacto → upsert en ActivityCategory
    expect(mocks.mockActivityCategoryUpsert).toHaveBeenCalledTimes(1);
  });

  it('mapea "taller" como WORKSHOP en mapActivityType si está en el título', async () => {
    const batch = makeBatchResult([{
      data: { ...actividadNLPBase, title: 'Taller creativo', categories: ['Talleres'] },
    }]);
    await storage.saveBatchResults(batch);
    const actividadCreada = mocks.mockActivityCreate.mock.calls[0]?.[0]?.data;
    if (actividadCreada) {
      expect(actividadCreada.type).toBe('WORKSHOP');
    }
  });

  it('mapea "workshop" (inglés) como WORKSHOP', async () => {
    const batch = makeBatchResult([{
      data: { ...actividadNLPBase, title: 'Creative workshop for kids', categories: ['Arts'] },
    }]);
    await storage.saveBatchResults(batch);
    const d = mocks.mockActivityCreate.mock.calls[0]?.[0]?.data;
    expect(d.type).toBe('WORKSHOP');
  });

  it('mapea "vacacional" como CAMP', async () => {
    const batch = makeBatchResult([{
      data: { ...actividadNLPBase, title: 'Club vacacional de verano', categories: ['Actividades'] },
    }]);
    await storage.saveBatchResults(batch);
    const d = mocks.mockActivityCreate.mock.calls[0]?.[0]?.data;
    expect(d.type).toBe('CAMP');
  });

  it('mapea "camp" (inglés) como CAMP', async () => {
    const batch = makeBatchResult([{
      data: { ...actividadNLPBase, title: 'Summer camp for children', categories: ['Outdoor'] },
    }]);
    await storage.saveBatchResults(batch);
    const d = mocks.mockActivityCreate.mock.calls[0]?.[0]?.data;
    expect(d.type).toBe('CAMP');
  });
});

describe('ScrapingStorage.saveActivity() — casos adicionales', () => {
  let storage: ScrapingStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockVerticalFindUnique.mockResolvedValue(mocks.mockVertical);
    mocks.mockProviderFindFirst.mockResolvedValue(null);
    mocks.mockProviderUpsert.mockResolvedValue(mocks.mockProvider);
    mocks.mockActivityFindFirst.mockResolvedValue(null);
    mocks.mockActivityCreate.mockResolvedValue(mocks.mockActivity);
    mocks.mockActivityFindMany.mockResolvedValue([]);
    mocks.mockCategoryFindMany.mockResolvedValue([]);
    mocks.mockActivityCategoryUpsert.mockResolvedValue({});
    storage = new ScrapingStorage();
  });

  it('retorna null si ocurre un error inesperado (catch branch)', async () => {
    mocks.mockProviderUpsert.mockRejectedValue(new Error('DB connection lost'));
    const result = await storage.saveActivity(
      actividadNLPBase,
      'https://ejemplo.com/actividad-err',
    );
    expect(result).toBeNull();
  });

  it('mapea "campamento" como CAMP si está en el título porque la categoría ahora es Aire Libre', async () => {
    const batch = makeBatchResult([{
      data: { ...actividadNLPBase, title: 'Campamento de verano', categories: ['Aire Libre'] },
    }]);
    await storage.saveBatchResults(batch);
    const d = mocks.mockActivityCreate.mock.calls[0]?.[0]?.data;
    expect(d.type).toBe('CAMP');
  });

  it('mapea categoría sin campamento ni taller como ONE_TIME', async () => {
    const batch = makeBatchResult([{
      data: { ...actividadNLPBase, title: 'Clase musical', categories: ['Música', 'Danza'] },
    }]);
    await storage.saveBatchResults(batch);
    const d = mocks.mockActivityCreate.mock.calls[0]?.[0]?.data;
    expect(d.type).toBe('ONE_TIME');
  });

  it('usa getOrCreateInstagramProvider cuando platform=INSTAGRAM con provider existente', async () => {
    const igProv = { id: 'ig-prov-1', name: '@testaccount' };
    mocks.mockProviderFindFirst.mockResolvedValue(igProv);

    const result = await storage.saveActivity(
      actividadNLPBase,
      'https://www.instagram.com/p/ABC123/',
      'kids',
      { platform: 'INSTAGRAM', instagramUsername: 'testaccount' },
    );
    expect(result).toBe('act-001');
    expect(mocks.mockProviderFindFirst).toHaveBeenCalledWith({
      where: { instagram: 'testaccount' },
    });
    expect(mocks.mockProviderCreate).not.toHaveBeenCalled();
  });

  it('crea provider Instagram nuevo si no existe', async () => {
    // First findFirst for IG provider → null
    // Second findFirst for activity → null
    let findFirstCalls = 0;
    mocks.mockProviderFindFirst.mockImplementation(() => {
      findFirstCalls++;
      return Promise.resolve(null);
    });

    const result = await storage.saveActivity(
      actividadNLPBase,
      'https://www.instagram.com/p/XYZ/',
      'kids',
      { platform: 'INSTAGRAM', instagramUsername: 'nuevacuenta' },
    );
    expect(result).toBe('act-001');
    expect(mocks.mockProviderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: '@nuevacuenta',
        instagram: 'nuevacuenta',
        type: 'INSTITUTION',
      }),
    });
  });

  it('activityCategory upsert error se ignora silenciosamente', async () => {
    mocks.mockActivityCategoryUpsert.mockRejectedValue(new Error('Duplicate'));
    mocks.mockCategoryFindMany.mockResolvedValue([
      { id: 'cat-1', name: 'Arte', verticalId: 'vert-001' },
    ]);
    const batch = makeBatchResult([{
      data: { ...actividadNLPBase, categories: ['Arte'] },
    }]);
    const result = await storage.saveBatchResults(batch);
    expect(result.saved).toBe(1);
  });

  it('incluye schedules como JSON cuando hay datos', async () => {
    const withSchedule: ActivityNLPResult = {
      ...actividadNLPBase,
      schedules: [{ startDate: '2026-04-01', endDate: '2026-04-30', notes: undefined }],
    };
    const batch = makeBatchResult([{ data: withSchedule }]);
    await storage.saveBatchResults(batch);
    const d = mocks.mockActivityCreate.mock.calls[0]?.[0]?.data;
    expect(d.schedule).toEqual({ items: withSchedule.schedules });
  });

  it('usa Prisma.JsonNull cuando no hay schedules', async () => {
    const noSchedule: ActivityNLPResult = {
      ...actividadNLPBase,
      schedules: undefined,
    };
    const batch = makeBatchResult([{ data: noSchedule }]);
    await storage.saveBatchResults(batch);
    const d = mocks.mockActivityCreate.mock.calls[0]?.[0]?.data;
    expect(d.schedule).toBe('__JSON_NULL__'); // Our mocked Prisma.JsonNull
  });

  it('usa exact match de categoría (c.name.toLowerCase() === normalizedQuery)', async () => {
    // El partial match fue eliminado en v0.12.0 — ahora solo match exacto
    // 'Arte plásticas' NO coincide con 'arte' → no debería upsert
    mocks.mockCategoryFindMany.mockResolvedValue([
      { id: 'cat-1', name: 'Arte plásticas', verticalId: 'vert-001' },
    ]);
    const batch = makeBatchResult([{
      data: { ...actividadNLPBase, categories: ['arte'] },
    }]);
    await storage.saveBatchResults(batch);
    // Sin match exacto → upsert NO debe llamarse
    expect(mocks.mockActivityCategoryUpsert).not.toHaveBeenCalled();
  });
});

describe('ScrapingStorage.disconnect()', () => {
  it('llama $disconnect sin errores', async () => {
    const storage = new ScrapingStorage();
    await expect(storage.disconnect()).resolves.not.toThrow();
    expect(mocks.mockDisconnect).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Filtro adaptativo
// ---------------------------------------------------------------------------
describe('ScrapingStorage — filtro adaptativo (adaptive-rules)', () => {
  let storage: ScrapingStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockVerticalFindUnique.mockResolvedValue(mocks.mockVertical);
    mocks.mockProviderFindFirst.mockResolvedValue(null);
    mocks.mockProviderUpsert.mockResolvedValue(mocks.mockProvider);
    mocks.mockActivityFindFirst.mockResolvedValue(null);
    mocks.mockActivityCreate.mockResolvedValue(mocks.mockActivity);
    mocks.mockActivityFindMany.mockResolvedValue([]);
    mocks.mockContentQualityMetricFindFirst.mockResolvedValue(null);
    mocks.mockSourceHealthFindMany.mockResolvedValue([]);
    storage = new ScrapingStorage();
  });

  it('saveBatchResults carga contentQualityMetric y sourceHealth exactamente una vez', async () => {
    const batch = makeBatchResult([{ data: actividadNLPBase }]);
    await storage.saveBatchResults(batch);
    expect(mocks.mockContentQualityMetricFindFirst).toHaveBeenCalledTimes(1);
    expect(mocks.mockSourceHealthFindMany).toHaveBeenCalledTimes(1);
  });

  it('descarta actividad cuya descripción cae por debajo de minLength global (pctShort alto)', async () => {
    // pctShort > 20 → getAdaptiveRules devuelve minDescriptionLength: 60
    mocks.mockContentQualityMetricFindFirst.mockResolvedValue({ pctShort: 25, pctNoise: 5 });
    const shortDesc = 'Texto corto.'; // 12 chars < 60
    const batch = makeBatchResult([{
      data: { ...actividadNLPBase, description: shortDesc },
    }]);
    const result = await storage.saveBatchResults(batch);
    expect(result.discarded).toBe(1);
    expect(result.saved).toBe(0);
    expect(mocks.mockActivityCreate).not.toHaveBeenCalled();
  });

  it('descarta actividad cuya descripción cae por debajo de minLength de fuente (score bajo)', async () => {
    // score < 0.4 → getSourceRules devuelve minDescriptionLength: 80
    mocks.mockSourceHealthFindMany.mockResolvedValue([
      { source: 'ejemplo.com', score: 0.3 },
    ]);
    const mediumDesc = 'Descripción de longitud media que tiene menos de ochenta caracteres.'; // < 80
    const batch = makeBatchResult([{
      data: { ...actividadNLPBase, description: mediumDesc },
    }]);
    const result = await storage.saveBatchResults(batch);
    expect(result.discarded).toBe(1);
    expect(mocks.mockActivityCreate).not.toHaveBeenCalled();
  });

  it('aplica Math.max entre regla global y de fuente (toma el más estricto)', async () => {
    // global → minLength 60 (pctShort alto)
    // fuente → minLength 80 (score bajo)  ← debe ganar
    mocks.mockContentQualityMetricFindFirst.mockResolvedValue({ pctShort: 25, pctNoise: 5 });
    mocks.mockSourceHealthFindMany.mockResolvedValue([
      { source: 'ejemplo.com', score: 0.3 },
    ]);
    // descripción de 70 chars: pasa regla global (60) pero NO la de fuente (80)
    const desc70 = 'A'.repeat(70);
    const batch = makeBatchResult([{
      data: { ...actividadNLPBase, description: desc70 },
    }]);
    const result = await storage.saveBatchResults(batch);
    expect(result.discarded).toBe(1);
  });

  it('guarda actividad cuando descripción supera el minLength adaptativo', async () => {
    mocks.mockContentQualityMetricFindFirst.mockResolvedValue({ pctShort: 25, pctNoise: 5 });
    // descripción >= 60 chars → pasa
    const desc65 = 'B'.repeat(65);
    const batch = makeBatchResult([{
      data: { ...actividadNLPBase, description: desc65 },
    }]);
    const result = await storage.saveBatchResults(batch);
    expect(result.saved).toBe(1);
    expect(result.discarded).toBe(0);
  });

  it('usa score 0.5 por defecto cuando la fuente no está en sourceHealthMap', async () => {
    // score 0.5 → getSourceRules devuelve minLength 40 (rama default)
    // global sin métricas → minLength 40
    // Math.max(40, 40) = 40 → la actividad base (>40 chars) pasa
    mocks.mockSourceHealthFindMany.mockResolvedValue([]); // fuente desconocida
    const batch = makeBatchResult([{ data: actividadNLPBase }]);
    const result = await storage.saveBatchResults(batch);
    expect(result.saved).toBe(1);
  });
});

describe('ScrapingStorage — detección de duplicados (findPotentialDuplicate)', () => {
  let storage: ScrapingStorage;

  // Actividad con el mismo título que actividadNLPBase → 100% Jaccard similarity
  const duplicateBase = {
    id: 'existing-dup-001',
    title: 'Taller de arte para niños',
    startDate: null as Date | null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockVerticalFindUnique.mockResolvedValue(mocks.mockVertical);
    mocks.mockProviderFindFirst.mockResolvedValue(null);
    mocks.mockProviderUpsert.mockResolvedValue(mocks.mockProvider);
    mocks.mockActivityFindFirst.mockResolvedValue(null);
    mocks.mockActivityCreate.mockResolvedValue(mocks.mockActivity);
    mocks.mockActivityFindMany.mockResolvedValue([]);
    storage = new ScrapingStorage();
  });

  it('reutiliza ID existente cuando hay duplicado sin fechas (ninguna tiene startDate)', async () => {
    mocks.mockActivityFindMany.mockResolvedValue([duplicateBase]);

    const result = await storage.saveActivity(actividadNLPBase, 'https://ejemplo.com/dup');

    expect(result).toBe('existing-dup-001');
    expect(mocks.mockActivityCreate).not.toHaveBeenCalled();
  });

  it('reutiliza ID cuando duplicado tiene startDate dentro de 30 días', async () => {
    const dupWithDate = { ...duplicateBase, startDate: new Date('2026-04-02') };
    mocks.mockActivityFindMany.mockResolvedValue([dupWithDate]);

    const dataWithDate = {
      ...actividadNLPBase,
      schedules: [{ startDate: '2026-04-01', endDate: undefined, notes: undefined }],
    };
    const result = await storage.saveActivity(dataWithDate, 'https://ejemplo.com/dup-date');

    expect(result).toBe('existing-dup-001');
    expect(mocks.mockActivityCreate).not.toHaveBeenCalled();
  });

  it('crea actividad nueva cuando título similar pero fechas con más de 30 días de diferencia', async () => {
    const dupFarDate = { ...duplicateBase, startDate: new Date('2026-09-01') };
    mocks.mockActivityFindMany.mockResolvedValue([dupFarDate]);

    const dataWithDate = {
      ...actividadNLPBase,
      schedules: [{ startDate: '2026-04-01', endDate: undefined, notes: undefined }],
    };
    await storage.saveActivity(dataWithDate, 'https://ejemplo.com/no-dup');

    expect(mocks.mockActivityCreate).toHaveBeenCalledTimes(1);
  });

  it('crea actividad nueva cuando no hay actividades recientes similares', async () => {
    mocks.mockActivityFindMany.mockResolvedValue([
      { ...duplicateBase, id: 'other', title: 'Curso de música avanzado' },
    ]);

    await storage.saveActivity(actividadNLPBase, 'https://ejemplo.com/nuevo');

    expect(mocks.mockActivityCreate).toHaveBeenCalledTimes(1);
  });

  it('continúa normalmente si findMany lanza un error (catch silencioso)', async () => {
    mocks.mockActivityFindMany.mockRejectedValue(new Error('DB timeout'));

    const result = await storage.saveActivity(actividadNLPBase, 'https://ejemplo.com/err');

    // El catch en findPotentialDuplicate devuelve null → saveActivity crea la actividad
    expect(mocks.mockActivityCreate).toHaveBeenCalledTimes(1);
    expect(result).toBe('act-001');
  });

  it('activityData maneja campos opcionales nulos (price null, sin currency, pricePeriod no nulo, sin audience, sin maxAge)', async () => {
    const dataConNulos = {
      ...actividadNLPBase,
      price: null,
      currency: undefined,       // undefined → fallback 'COP'
      pricePeriod: 'mensual',    // valor no-enum → pasa tal cual al storage
      audience: undefined,       // undefined → fallback 'ALL'
      maxAge: undefined,
    } as unknown as ActivityNLPResult;

    const result = await storage.saveActivity(dataConNulos, 'https://ejemplo.com/nulos');

    expect(result).toBe('act-001');
    const d = mocks.mockActivityCreate.mock.calls[0]?.[0]?.data;
    expect(d.price).toBeNull();
    expect(d.priceCurrency).toBe('COP');   // fallback cuando currency es falsy
    expect(d.pricePeriod).toBe('mensual'); // pricePeriod ?? null → 'mensual'
    expect(d.audience).toBe('ALL');        // audience ?? 'ALL'
    expect(d.ageMax).toBeNull();           // maxAge ?? null
  });

  it('description vacía ahora causa descarte en la validación (return string)', async () => {
    const dataConDescVacia: ActivityNLPResult = {
      ...actividadNLPBase,
      description: '',
    };

    const result = await storage.saveActivity(dataConDescVacia, 'https://ejemplo.com/descvacia');
    expect(result).toBe('DISCARDED_QUALITY');
  });

  it('ageMin undefined se mapea a null (branch ?? del campo minAge)', async () => {
    const dataConEdadUndefined: ActivityNLPResult = {
      ...actividadNLPBase,
      minAge: undefined,
    };

    await storage.saveActivity(dataConEdadUndefined, 'https://ejemplo.com/edadundefined');

    const d = mocks.mockActivityCreate.mock.calls[0]?.[0]?.data;
    expect(d.ageMin).toBeNull();
  });

  it('startDate es null cuando schedules existe pero schedules[0].startDate es undefined', async () => {
    const dataConSchedulesSinFechas: ActivityNLPResult = {
      ...actividadNLPBase,
      schedules: [{ startDate: undefined as any, endDate: undefined as any, notes: undefined }],
    };

    const result = await storage.saveActivity(dataConSchedulesSinFechas, 'https://ejemplo.com/sinfechas');

    expect(result).toBe('act-001');
    const d = mocks.mockActivityCreate.mock.calls[0]?.[0]?.data;
    expect(d.startDate).toBeNull();
    expect(d.endDate).toBeNull();
  });

  it('audience null se mapea a ALL (branch null del operador ??)', async () => {
    const dataAudienceNull: ActivityNLPResult = {
      ...actividadNLPBase,
      audience: null as any,
    };

    await storage.saveActivity(dataAudienceNull, 'https://ejemplo.com/audiencenull');

    const d = mocks.mockActivityCreate.mock.calls[0]?.[0]?.data;
    expect(d.audience).toBe('ALL');
  });
});
