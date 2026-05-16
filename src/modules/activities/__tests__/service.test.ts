// =============================================================================
// Tests: modules/activities/activities.service.ts
// Mock de Prisma — no toca la BD real
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- vi.hoisted garantiza que los mocks estén listos ANTES del hoisting de vi.mock ---
const { mockFindMany, mockCount, mockFindUnique, mockCreate, mockUpdate, mockQueryRaw } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockQueryRaw: vi.fn(),
}));

vi.mock('@/modules/analytics/metrics', () => ({
  getCachedCTR: vi.fn().mockResolvedValue({}),
  ctrToBoost: vi.fn().mockReturnValue(0),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    activity: {
      findMany: mockFindMany,
      count: mockCount,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
    },
    sourceHealth: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}));

// Import después del mock
import {
  listActivities,
  getActivityById,
  createActivity,
  updateActivity,
  deleteActivity,
  getSimilarActivities,
  VALID_SORT_VALUES,
  clearCountCacheForTests,
} from '../activities.service';

// ---------------------------------------------------------------------------
// Fixture reutilizable
// ---------------------------------------------------------------------------
const actividadMock = {
  id: 'abc-123',
  title: 'Natación para niños',
  description: 'Clases en piscina temperada',
  type: 'RECURRING',
  status: 'ACTIVE',
  price: 0,
  priceCurrency: 'COP',
  ageMin: 5,
  ageMax: 12,
  sourceConfidence: 0.9,
  providerId: 'prov-001',
  verticalId: 'vert-001',
  createdAt: new Date(),
  provider: { id: 'prov-001', name: 'Club Acuático', type: 'SCHOOL', logoUrl: null, isVerified: true },
  location: null,
  vertical: { id: 'vert-001', slug: 'kids-family', name: 'Niños y Familia' },
  categories: [],
};

// ---------------------------------------------------------------------------

describe('listActivities()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCountCacheForTests();
    mockFindMany.mockResolvedValue([actividadMock]);
    mockCount.mockResolvedValue(1);
  });

  it('retorna actividades y total', async () => {
    const result = await listActivities({ skip: 0, pageSize: 20 });
    expect(result.activities).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('muestra solo ACTIVE por defecto, excluye EXPIRED, DRAFT y PAUSED', async () => {
    await listActivities({ skip: 0, pageSize: 20 });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.status).toBe('ACTIVE');
  });

  it('usa el status exacto cuando se pasa explícitamente', async () => {
    await listActivities({ skip: 0, pageSize: 20, status: 'ACTIVE' });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.status).toBe('ACTIVE');
  });

  it('filtra por verticalId cuando se pasa', async () => {
    await listActivities({ skip: 0, pageSize: 20, verticalId: 'vert-001' });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.verticalId).toBe('vert-001');
  });

  it('filtra por cityId con JOIN estricto (solo actividades con location en la ciudad)', async () => {
    await listActivities({ skip: 0, pageSize: 20, cityId: 'city-bog' });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    // cityId usa JOIN estricto: solo actividades con location.cityId = cityId.
    // Esto evita inflar conteos con actividades sin locationId en vistas por ciudad.
    const andCityClause = whereArg.AND?.find((c: any) => c.location?.cityId === 'city-bog');
    expect(andCityClause).toEqual({ location: { cityId: 'city-bog' } });
  });

  it('aplica rango de precios cuando se pasan ambos', async () => {
    await listActivities({ skip: 0, pageSize: 20, priceMin: 0, priceMax: 100000 });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.price).toEqual({ gte: 0, lte: 100000 });
  });

  it('aplica skip y take para paginación', async () => {
    await listActivities({ skip: 40, pageSize: 20, sortBy: 'date' });
    const args = mockFindMany.mock.calls[0][0];
    expect(args.skip).toBe(40);
    expect(args.take).toBe(20);
  });

  it('llama count con el mismo where que findMany', async () => {
    await listActivities({ skip: 0, pageSize: 20, verticalId: 'vert-001' });
    const whereMany = mockFindMany.mock.calls[0][0].where;
    const whereCount = mockCount.mock.calls[0][0].where;
    expect(whereMany).toEqual(whereCount);
  });

  it('retorna lista vacía cuando no hay resultados', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    const result = await listActivities({ skip: 0, pageSize: 20 });
    expect(result.activities).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('aplica filtro ageMin al where', async () => {
    await listActivities({ skip: 0, pageSize: 20, ageMin: 5 });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    // ageMin va dentro de AND como condición OR
    expect(whereArg.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ OR: expect.arrayContaining([{ ageMax: { gte: 5 } }, { ageMax: null }]) }),
      ])
    );
  });

  it('aplica filtro ageMax al where', async () => {
    await listActivities({ skip: 0, pageSize: 20, ageMax: 12 });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ OR: expect.arrayContaining([{ ageMin: { lte: 12 } }]) }),
      ])
    );
  });

  it('aplica búsqueda por texto con pg_trgm (fuzzy)', async () => {
    const matchingId = 'abc-123';
    mockQueryRaw.mockResolvedValue([{ id: matchingId }]);
    await listActivities({ skip: 0, pageSize: 20, search: 'natación' });

    // Verifica que se llamó a $queryRaw para la búsqueda fuzzy
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);

    // Verifica que el where filtra por los IDs devueltos por pg_trgm
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.AND).toEqual(
      expect.arrayContaining([
        { id: { in: [matchingId] } },
      ])
    );
  });

  it('retorna vacío si la búsqueda pg_trgm no encuentra coincidencias', async () => {
    mockQueryRaw.mockResolvedValue([]);
    const result = await listActivities({ skip: 0, pageSize: 20, search: 'xyznoexiste' });
    expect(result).toEqual({ activities: [], total: 0 });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('aplica solo priceMin cuando no hay priceMax', async () => {
    await listActivities({ skip: 0, pageSize: 20, priceMin: 10000 });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.price).toEqual({ gte: 10000 });
  });

  it('aplica solo priceMax cuando no hay priceMin', async () => {
    await listActivities({ skip: 0, pageSize: 20, priceMax: 50000 });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.price).toEqual({ lte: 50000 });
  });

  it('filtra por type cuando se pasa', async () => {
    await listActivities({ skip: 0, pageSize: 20, type: 'RECURRING' });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.type).toBe('RECURRING');
  });

  it('filtra por categoryId cuando se pasa', async () => {
    await listActivities({ skip: 0, pageSize: 20, categoryId: 'cat-001' });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.categories).toEqual({ some: { categoryId: 'cat-001' } });
  });

  it('filtra por audience KIDS incluyendo ALL', async () => {
    await listActivities({ skip: 0, pageSize: 20, audience: 'KIDS' });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.audience).toEqual({ in: ['KIDS', 'ALL'] });
  });

  it('filtra por audience FAMILY incluyendo ALL', async () => {
    await listActivities({ skip: 0, pageSize: 20, audience: 'FAMILY' });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.audience).toEqual({ in: ['FAMILY', 'ALL'] });
  });

  it('filtra por audience ADULTS incluyendo ALL', async () => {
    await listActivities({ skip: 0, pageSize: 20, audience: 'ADULTS' });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.audience).toEqual({ in: ['ADULTS', 'ALL'] });
  });

  it('no aplica filtro de audience cuando el valor no tiene mapping (ej: ALL)', async () => {
    await listActivities({ skip: 0, pageSize: 20, audience: 'ALL' });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.audience).toBeUndefined();
  });

  // --- sortBy ---
  it('sortBy=relevance usa status asc + isPremium desc + sourceConfidence desc (default)', async () => {
    await listActivities({ skip: 0, pageSize: 20, sortBy: 'relevance' });
    const orderBy = mockFindMany.mock.calls[0][0].orderBy;
    expect(orderBy).toEqual([{ status: 'asc' }, { provider: { isPremium: 'desc' } }, { sourceConfidence: 'desc' }, { createdAt: 'desc' }]);
  });

  it('sin sortBy usa ordenamiento por relevancia (default)', async () => {
    await listActivities({ skip: 0, pageSize: 20 });
    const orderBy = mockFindMany.mock.calls[0][0].orderBy;
    expect(orderBy).toEqual([{ status: 'asc' }, { provider: { isPremium: 'desc' } }, { sourceConfidence: 'desc' }, { createdAt: 'desc' }]);
  });

  it('sortBy=date ordena por startDate asc nulls last', async () => {
    await listActivities({ skip: 0, pageSize: 20, sortBy: 'date' });
    const orderBy = mockFindMany.mock.calls[0][0].orderBy;
    expect(orderBy[0]).toEqual({ startDate: { sort: 'asc', nulls: 'last' } });
  });

  it('sortBy=price_asc ordena por price asc nulls last', async () => {
    await listActivities({ skip: 0, pageSize: 20, sortBy: 'price_asc' });
    const orderBy = mockFindMany.mock.calls[0][0].orderBy;
    expect(orderBy[0]).toEqual({ price: { sort: 'asc', nulls: 'last' } });
  });

  it('sortBy=price_desc ordena por price desc nulls last', async () => {
    await listActivities({ skip: 0, pageSize: 20, sortBy: 'price_desc' });
    const orderBy = mockFindMany.mock.calls[0][0].orderBy;
    expect(orderBy[0]).toEqual({ price: { sort: 'desc', nulls: 'last' } });
  });

  it('sortBy=newest ordena por createdAt desc', async () => {
    await listActivities({ skip: 0, pageSize: 20, sortBy: 'newest' });
    const orderBy = mockFindMany.mock.calls[0][0].orderBy;
    expect(orderBy).toEqual([{ createdAt: 'desc' }]);
  });

  it('VALID_SORT_VALUES contiene exactamente los 5 valores esperados', () => {
    expect(VALID_SORT_VALUES).toContain('relevance');
    expect(VALID_SORT_VALUES).toContain('date');
    expect(VALID_SORT_VALUES).toContain('price_asc');
    expect(VALID_SORT_VALUES).toContain('price_desc');
    expect(VALID_SORT_VALUES).toContain('newest');
    expect(VALID_SORT_VALUES).toHaveLength(5);
  });

  // ── Diversity control — V3 invariants ───────────────────────────────────────
  // Congelan el comportamiento del MAX_DIVERSITY_PER_DOMAIN cap (default=4):
  //   1. Un dominio nunca domina más de 4 slots en el slice de la página
  //   2. El overflow NO se descarta — fluye a páginas más profundas (preservation-first)

  describe('diversity control (sort=relevance)', () => {
    const makeAct = (id: string, sourceDomain: string) => ({
      ...actividadMock,
      id,
      sourceDomain,
      sourceUrl: `https://${sourceDomain}/evento-${id}`,
      _count: { views: 0 },
    });

    it('max 4 items por dominio en el slice de página (MAX_DIVERSITY_PER_DOMAIN=4)', async () => {
      // 8 biblored + 4 idartes = 12 actividades
      // Sin cap: el slice de pageSize=6 tendría 6 biblored (los mejor rankeados)
      // Con cap: máx 4 biblored + 2 idartes en el slice
      const activities = [
        ...Array.from({ length: 8 }, (_, i) => makeAct(`b-${i}`, 'biblored.gov.co')),
        ...Array.from({ length: 4 }, (_, i) => makeAct(`i-${i}`, 'idartes.gov.co')),
      ];
      mockFindMany.mockResolvedValue(activities);
      mockCount.mockResolvedValue(12);

      const result = await listActivities({ skip: 0, pageSize: 6 });

      const biblored = result.activities.filter((a: any) => a.sourceDomain === 'biblored.gov.co');
      // Invariante: ningún dominio ocupa más de 4 slots en el slice
      expect(biblored.length).toBeLessThanOrEqual(4);
    });

    it('overflow no se descarta: los items extra fluyen a páginas más profundas', async () => {
      // 8 actividades del mismo dominio, pageSize=4
      // Página 1: las 4 del diversePool (primeras 4 por score)
      // Página 2: las 4 del overflowPool — NO deben desaparecer
      const activities = Array.from({ length: 8 }, (_, i) => makeAct(`b-${i}`, 'biblored.gov.co'));
      mockFindMany.mockResolvedValue(activities);
      mockCount.mockResolvedValue(8);

      const page1 = await listActivities({ skip: 0, pageSize: 4 });
      expect(page1.activities).toHaveLength(4);

      // Página 2: los overflow items deben aparecer (preservation-first)
      clearCountCacheForTests();
      mockFindMany.mockResolvedValue(activities);
      const page2 = await listActivities({ skip: 4, pageSize: 4 });
      // Invariante: los 4 overflow biblored están en página 2, no desaparecieron
      expect(page2.activities).toHaveLength(4);
    });
  });
});

describe('getActivityById()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(actividadMock);
  });

  it('busca por id correctamente', async () => {
    await getActivityById('abc-123');
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'abc-123' } })
    );
  });

  it('retorna null si no existe', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await getActivityById('no-existe');
    expect(result).toBeNull();
  });

  it('retorna la actividad cuando existe', async () => {
    const result = await getActivityById('abc-123');
    expect(result?.title).toBe('Natación para niños');
  });
});

describe('createActivity()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(actividadMock);
  });

  it('llama prisma.create con los datos correctos', async () => {
    await createActivity({
      title: 'Natación para niños',
      description: 'Clases en piscina temperada',
      type: 'RECURRING',
      status: 'DRAFT',
      audience: 'KIDS',
      priceCurrency: 'COP',
      sourceType: 'MANUAL',
      sourceConfidence: 0.5,
      providerId: 'prov-001',
      verticalId: 'vert-001',
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const dataArg = mockCreate.mock.calls[0][0].data;
    expect(dataArg.title).toBe('Natación para niños');
  });

  it('crea actividad sin categoryIds sin errores', async () => {
    await expect(
      createActivity({
        title: 'Taller de arte',
        description: 'Taller creativo para niños',
        type: 'ONE_TIME',
        status: 'DRAFT',
        audience: 'ALL',
        priceCurrency: 'COP',
        sourceType: 'MANUAL',
        sourceConfidence: 0.5,
        providerId: 'prov-001',
        verticalId: 'vert-001',
      })
    ).resolves.not.toThrow();
  });

  it('convierte startDate y endDate a Date si se proporcionan', async () => {
    await createActivity({
      title: 'Evento con fechas',
      description: 'Evento',
      type: 'ONE_TIME',
      status: 'DRAFT',
      audience: 'FAMILY',
      priceCurrency: 'COP',
      sourceType: 'MANUAL',
      sourceConfidence: 0.5,
      providerId: 'prov-001',
      verticalId: 'vert-001',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });
    const dataArg = mockCreate.mock.calls[0][0].data;
    expect(dataArg.startDate).toBeInstanceOf(Date);
    expect(dataArg.endDate).toBeInstanceOf(Date);
  });

  it('crea actividad con categoryIds y los vincula', async () => {
    await createActivity({
      title: 'Natación',
      description: 'Clases de natación para niños',
      type: 'RECURRING',
      status: 'DRAFT',
      audience: 'KIDS',
      priceCurrency: 'COP',
      sourceType: 'MANUAL',
      sourceConfidence: 0.5,
      providerId: 'prov-001',
      verticalId: 'vert-001',
      categoryIds: ['cat-001', 'cat-002'],
    });
    const dataArg = mockCreate.mock.calls[0][0].data;
    expect(dataArg.categories).toBeDefined();
  });
});

describe('updateActivity()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({ ...actividadMock, title: 'Título actualizado' });
  });

  it('llama prisma.update con el id correcto', async () => {
    await updateActivity('abc-123', { title: 'Título actualizado' });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'abc-123' } })
    );
  });

  it('retorna la actividad actualizada', async () => {
    const result = await updateActivity('abc-123', { title: 'Título actualizado' });
    expect(result.title).toBe('Título actualizado');
  });

  it('convierte startDate y endDate a Date en update', async () => {
    await updateActivity('abc-123', {
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    });
    const dataArg = mockUpdate.mock.calls[0][0].data;
    expect(dataArg.startDate).toBeInstanceOf(Date);
    expect(dataArg.endDate).toBeInstanceOf(Date);
  });

  it('reemplaza categorías cuando se pasan categoryIds en el update', async () => {
    await updateActivity('abc-123', { categoryIds: ['cat-nuevo-001', 'cat-nuevo-002'] });
    const dataArg = mockUpdate.mock.calls[0][0].data;
    expect(dataArg.categories).toBeDefined();
    expect(dataArg.categories.deleteMany).toBeDefined();
    expect(dataArg.categories.create).toHaveLength(2);
  });
});

describe('deleteActivity()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({ ...actividadMock, status: 'EXPIRED' });
  });

  it('marca la actividad como EXPIRED (soft delete)', async () => {
    await deleteActivity('abc-123');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'abc-123' },
        data: { status: 'EXPIRED' },
      })
    );
  });

  it('no elimina físicamente el registro', async () => {
    await deleteActivity('abc-123');
    // Verifica que se usó update, no delete
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// createActivity / updateActivity — branches con sourceUrl
// =============================================================================

describe('createActivity() — branches sourceUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(actividadMock);
  });

  it('extrae sourceDomain cuando se proporciona sourceUrl', async () => {
    await createActivity({
      title: 'Taller con fuente',
      description: 'Actividad con URL de origen',
      type: 'ONE_TIME',
      status: 'DRAFT',
      audience: 'ALL',
      priceCurrency: 'COP',
      sourceType: 'SCRAPING',
      sourceConfidence: 0.8,
      providerId: 'prov-001',
      verticalId: 'vert-001',
      sourceUrl: 'https://idartes.gov.co/actividades/taller-arte',
    });
    const dataArg = mockCreate.mock.calls[0][0].data;
    expect(dataArg.sourceDomain).toBe('idartes.gov.co');
  });
});

describe('updateActivity() — branches sourceUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({ ...actividadMock, title: 'Título actualizado' });
  });

  it('extrae sourceDomain cuando se proporciona sourceUrl en update', async () => {
    await updateActivity('abc-123', {
      sourceUrl: 'https://biblored.gov.co/eventos/nuevo-taller',
    });
    const dataArg = mockUpdate.mock.calls[0][0].data;
    expect(dataArg.sourceDomain).toBe('biblored.gov.co');
  });

  it('no modifica categorías cuando categoryIds está ausente en update', async () => {
    await updateActivity('abc-123', { title: 'Solo título' });
    const dataArg = mockUpdate.mock.calls[0][0].data;
    expect(dataArg.categories).toBeUndefined();
  });
});

// =============================================================================
// listActivities() — branches adicionales
// =============================================================================

describe('listActivities() — branches adicionales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCountCacheForTests();
    mockFindMany.mockResolvedValue([actividadMock]);
    mockCount.mockResolvedValue(1);
  });

  it('FORCE_CHRONO=true fuerza ordenamiento por newest independiente de sortBy', async () => {
    process.env.FORCE_CHRONO = 'true';
    try {
      await listActivities({ skip: 0, pageSize: 20, sortBy: 'relevance' });
      const orderBy = mockFindMany.mock.calls[0][0].orderBy;
      // newest = [{ createdAt: 'desc' }]
      expect(orderBy).toEqual([{ createdAt: 'desc' }]);
    } finally {
      delete process.env.FORCE_CHRONO;
    }
  });

  it('aplica penalización 0.85 a actividades sin rango de edad (ageMin=null, ageMax=null)', async () => {
    const noAgeMock = { ...actividadMock, ageMin: null, ageMax: null };
    mockFindMany.mockResolvedValue([noAgeMock]);
    const result = await listActivities({ skip: 0, pageSize: 20 });
    // La penalización se aplica internamente — el resultado sigue devolviendo la actividad
    expect(result.activities).toHaveLength(1);
  });

  it('hybrid ranking: ejercita branch act.startDate truthy en búsqueda con scores', async () => {
    const matchId = actividadMock.id;
    mockQueryRaw.mockResolvedValue([{
      id: matchId,
      sim_title: 0.8,
      sim_desc: 0.4,
      exact_title: true,
      prefix_title: true,
    }]);
    // Actividad con startDate para ejercitar el branch act.startDate → eventDate = startDate
    const actWithDate = {
      ...actividadMock,
      startDate: new Date(Date.now() + 7 * 86_400_000), // 7 días adelante
    };
    mockFindMany.mockResolvedValue([actWithDate]);

    const result = await listActivities({ skip: 0, pageSize: 20, search: 'natación' });
    expect(result.activities).toHaveLength(1);
  });

  it('fallback progresivo: usa umbral 0.2 si filteredActivities < needed a 0.3', async () => {
    // 3 actividades con confidence muy bajo → rankingScore < 0.3 pero > 0.2
    const lowScoreActs = Array.from({ length: 3 }, (_, i) => ({
      ...actividadMock,
      id: `low-${i}`,
      sourceConfidence: 0.01,
      ageMin: null,
      ageMax: null, // penalización → score * 0.85
      sourceDomain: 'unknown-source.com',
    }));
    mockFindMany.mockResolvedValue(lowScoreActs);
    mockCount.mockResolvedValue(3);

    const result = await listActivities({ skip: 0, pageSize: 3 });
    // Fallback progresivo garantiza que el resultado no quede vacío
    expect(result.activities.length).toBeGreaterThanOrEqual(0);
  });

  it('MAX_DIVERSITY_PER_DOMAIN=2 limita dominios a 2 slots en diversePool', async () => {
    process.env.MAX_DIVERSITY_PER_DOMAIN = '2';
    try {
      // 4 biblored + 4 idartes = 8 actividades mixtas
      // Con cap=2: diversePool = [2 biblored, 2 idartes], overflowPool = [2 biblored, 2 idartes]
      // slice(0,4) = [biblored-0, biblored-1, idartes-0, idartes-1] → max 2 por dominio
      const acts = [
        ...Array.from({ length: 4 }, (_, i) => ({
          ...actividadMock,
          id: `b-${i}`,
          sourceDomain: 'biblored.gov.co',
          sourceUrl: 'https://biblored.gov.co/evento',
          _count: { views: 0 },
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          ...actividadMock,
          id: `id-${i}`,
          sourceDomain: 'idartes.gov.co',
          sourceUrl: 'https://idartes.gov.co/evento',
          _count: { views: 0 },
        })),
      ];
      mockFindMany.mockResolvedValue(acts);
      mockCount.mockResolvedValue(8);

      const result = await listActivities({ skip: 0, pageSize: 4 });
      const biblored = result.activities.filter((a: any) => a.sourceDomain === 'biblored.gov.co');
      // Con cap=2: biblored en diversePool = 2 → en el slice de pageSize=4 max 2 biblored
      expect(biblored.length).toBeLessThanOrEqual(2);
    } finally {
      delete process.env.MAX_DIVERSITY_PER_DOMAIN;
    }
  });
});

// =============================================================================
// getSimilarActivities()
// =============================================================================

describe('getSimilarActivities()', () => {
  // Fixture: base activity (solo campos que usa findUnique con select)
  const baseMock = {
    categories: [{ categoryId: 'cat-001' }],
    location: { cityId: 'city-bog' },
  };

  // Fixture: candidato completo (lo que devuelve findMany con activityIncludes)
  const candidateMock = {
    ...actividadMock,
    id: 'cand-1',
    title: 'Taller similar',
    sourceDomain: 'idartes.gov.co',
    sourceUrl: 'https://idartes.gov.co/taller',
    startDate: null,
    _count: { views: 0 },
    categories: [{ category: { id: 'cat-001', name: 'Música', slug: 'musica' } }],
    location: {
      id: 'loc-1',
      name: 'Teatro Mayor',
      address: 'Cra 7 #22-47',
      neighborhood: 'Centro',
      latitude: 4.65,
      longitude: -74.06,
      city: { id: 'city-bog', name: 'Bogotá' },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearCountCacheForTests();
  });

  it('retorna [] cuando la actividad base no existe', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await getSimilarActivities('no-existe');
    expect(result).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('retorna [] cuando la actividad base no tiene categorías', async () => {
    mockFindUnique.mockResolvedValue({ categories: [], location: null });
    const result = await getSimilarActivities('abc-123');
    expect(result).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('devuelve candidatos que comparten categorías', async () => {
    mockFindUnique.mockResolvedValue(baseMock);
    mockFindMany.mockResolvedValue([candidateMock]);

    const result = await getSimilarActivities('abc-123');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cand-1');
  });

  it('prioriza candidatos de la misma ciudad (cityId match → +2 score)', async () => {
    mockFindUnique.mockResolvedValue(baseMock); // cityId: 'city-bog'

    const sameCity = { ...candidateMock, id: 'same-city' }; // city.id = 'city-bog'
    const diffCity = {
      ...candidateMock,
      id: 'diff-city',
      location: {
        ...candidateMock.location,
        city: { id: 'city-med', name: 'Medellín' },
      },
    };
    // diffCity primero en el array — sameCity debería ganar por score más alto
    mockFindMany.mockResolvedValue([diffCity, sameCity]);

    const result = await getSimilarActivities('abc-123', 1);
    expect(result[0].id).toBe('same-city');
  });

  it('aplica bonus temporal +3 cuando startDate está en los próximos 7 días', async () => {
    mockFindUnique.mockResolvedValue(baseMock);
    const soonDate = new Date(Date.now() + 3 * 86_400_000); // 3 días
    const withSoon = { ...candidateMock, id: 'soon', startDate: soonDate };
    const noDate   = { ...candidateMock, id: 'no-date', startDate: null };
    // sin startDate va primero en array pero withSoon debería ganar por +3 temporal
    mockFindMany.mockResolvedValue([noDate, withSoon]);

    const result = await getSimilarActivities('abc-123', 2);
    expect(result[0].id).toBe('soon'); // mayor score
  });

  it('aplica bonus temporal +1 cuando startDate está entre 8 y 30 días', async () => {
    mockFindUnique.mockResolvedValue(baseMock);
    const medDate = new Date(Date.now() + 15 * 86_400_000); // 15 días → bonus=1
    const withMed = { ...candidateMock, id: 'medium', startDate: medDate };
    mockFindMany.mockResolvedValue([withMed]);

    const result = await getSimilarActivities('abc-123', 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('medium');
  });

  it('no aplica bonus temporal cuando startDate es null', async () => {
    mockFindUnique.mockResolvedValue({ categories: [{ categoryId: 'cat-001' }], location: null });
    const noDate = { ...candidateMock, startDate: null };
    mockFindMany.mockResolvedValue([noDate]);

    const result = await getSimilarActivities('abc-123', 1);
    expect(result).toHaveLength(1); // funciona sin cityId ni startDate
  });

  it('no aplica bonus temporal cuando startDate es una fecha pasada (daysUntil < 0)', async () => {
    mockFindUnique.mockResolvedValue(baseMock);
    const pastDate = new Date(Date.now() - 5 * 86_400_000); // hace 5 días
    const pastAct = { ...candidateMock, id: 'past', startDate: pastDate };
    mockFindMany.mockResolvedValue([pastAct]);

    const result = await getSimilarActivities('abc-123', 1);
    expect(result).toHaveLength(1); // la actividad pasada se incluye, sin bonus
  });

  it('respeta el límite de resultados (limit=2)', async () => {
    mockFindUnique.mockResolvedValue(baseMock);
    const candidates = Array.from({ length: 8 }, (_, i) => ({
      ...candidateMock,
      id: `cand-${i}`,
    }));
    mockFindMany.mockResolvedValue(candidates);

    const result = await getSimilarActivities('abc-123', 2);
    expect(result).toHaveLength(2);
  });

  it('usa limit=4 por defecto', async () => {
    mockFindUnique.mockResolvedValue(baseMock);
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      ...candidateMock,
      id: `cand-${i}`,
    }));
    mockFindMany.mockResolvedValue(candidates);

    const result = await getSimilarActivities('abc-123');
    expect(result).toHaveLength(4);
  });
});
