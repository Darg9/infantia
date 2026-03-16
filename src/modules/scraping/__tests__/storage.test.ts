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
    mockDisconnect: vi.fn().mockResolvedValue(undefined),
  };
});

// Mockeamos PrismaPg — debe ser una clase (no arrow function) para soportar 'new'
vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn().mockImplementation(function () { return {}; }),
}));

// Mockeamos PrismaClient — misma razón, debe ser función regular
vi.mock('../../../generated/prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(function () {
    return {
      vertical: { findUnique: mocks.mockVerticalFindUnique },
      provider: { upsert: mocks.mockProviderUpsert, findFirst: mocks.mockProviderFindFirst },
      activity: {
        findFirst: mocks.mockActivityFindFirst,
        create: mocks.mockActivityCreate,
        update: mocks.mockActivityUpdate,
      },
      category: { findMany: mocks.mockCategoryFindMany },
      activityCategory: { upsert: mocks.mockActivityCategoryUpsert },
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
  title: 'Taller de arte para niños',
  description: 'Taller creativo en el centro cultural',
  categories: ['Arte'],
  confidenceScore: 0.9,
  minAge: 6,
  maxAge: 12,
  price: 0,
  currency: 'COP',
  pricePeriod: null,
  schedules: [],
  location: null,
  isRecurring: false,
};

const makeBatchResult = (overrides: Partial<BatchPipelineResult['results'][0]>[] = []): BatchPipelineResult => ({
  totalUrls: overrides.length,
  processed: overrides.length,
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

  it('omite items con confidenceScore < 0.2', async () => {
    const batch = makeBatchResult([
      { data: { ...actividadNLPBase, confidenceScore: 0.1 } },
    ]);
    const result = await storage.saveBatchResults(batch);
    expect(result.skipped).toBe(1);
    expect(result.saved).toBe(0);
  });

  it('guarda items con confidenceScore >= 0.2', async () => {
    const batch = makeBatchResult([
      { data: { ...actividadNLPBase, confidenceScore: 0.2 } },
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

  it('mapea "taller" como WORKSHOP en mapActivityType', async () => {
    const batch = makeBatchResult([{
      data: { ...actividadNLPBase, categories: ['Taller de pintura'] },
    }]);
    await storage.saveBatchResults(batch);
    const actividadCreada = mocks.mockActivityCreate.mock.calls[0]?.[0]?.data;
    if (actividadCreada) {
      expect(actividadCreada.type).toBe('WORKSHOP');
    }
  });
});

describe('ScrapingStorage.disconnect()', () => {
  it('llama $disconnect sin errores', async () => {
    const storage = new ScrapingStorage();
    await expect(storage.disconnect()).resolves.not.toThrow();
    expect(mocks.mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
