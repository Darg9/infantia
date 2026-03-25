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
  },
}));

// Import después del mock
import {
  listActivities,
  getActivityById,
  createActivity,
  updateActivity,
  deleteActivity,
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
    mockFindMany.mockResolvedValue([actividadMock]);
    mockCount.mockResolvedValue(1);
  });

  it('retorna actividades y total', async () => {
    const result = await listActivities({ skip: 0, pageSize: 20 });
    expect(result.activities).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('incluye ACTIVE y EXPIRED por defecto, excluye DRAFT y PAUSED', async () => {
    await listActivities({ skip: 0, pageSize: 20 });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.status).toEqual({ in: ['ACTIVE', 'EXPIRED'] });
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

  it('filtra por cityId cuando se pasa', async () => {
    await listActivities({ skip: 0, pageSize: 20, cityId: 'city-bog' });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.location).toEqual({ cityId: 'city-bog' });
  });

  it('aplica rango de precios cuando se pasan ambos', async () => {
    await listActivities({ skip: 0, pageSize: 20, priceMin: 0, priceMax: 100000 });
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.price).toEqual({ gte: 0, lte: 100000 });
  });

  it('aplica skip y take para paginación', async () => {
    await listActivities({ skip: 40, pageSize: 20 });
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
