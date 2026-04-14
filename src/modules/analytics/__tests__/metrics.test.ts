// =============================================================================
// Tests: src/modules/analytics/metrics.ts
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks hoisted ---
const mocks = vi.hoisted(() => ({
  mockEventGroupBy: vi.fn(),
  mockActivityFindMany: vi.fn(),
  mockLogError: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    event: { groupBy: mocks.mockEventGroupBy },
    activity: { findMany: mocks.mockActivityFindMany },
  },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: mocks.mockLogError,
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

// ranking.ts se importa real (función pura, sin dependencias externas)
import { getCTRByDomain, ctrToBoost, clearCTRCacheForTests } from '../metrics';

// ---------------------------------------------------------------------------

describe('getCTRByDomain()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCTRCacheForTests();
  });

  it('retorna {} si no hay activity_view events', async () => {
    mocks.mockEventGroupBy.mockResolvedValue([]);   // clicks y views vacíos
    const result = await getCTRByDomain();
    expect(result).toEqual({});
  });

  it('calcula CTR correctamente por dominio', async () => {
    // clicks: 2 por act-001, 1 por act-002
    mocks.mockEventGroupBy
      .mockResolvedValueOnce([
        { activityId: 'act-001', _count: { activityId: 2 } },
        { activityId: 'act-002', _count: { activityId: 1 } },
      ])
      // views: 10 por act-001, 5 por act-002
      .mockResolvedValueOnce([
        { activityId: 'act-001', _count: { activityId: 10 } },
        { activityId: 'act-002', _count: { activityId: 5 } },
      ]);

    mocks.mockActivityFindMany.mockResolvedValue([
      { id: 'act-001', sourceUrl: 'https://biblored.gov.co/evento/1' },
      { id: 'act-002', sourceUrl: 'https://biblored.gov.co/evento/2' },
    ]);

    const result = await getCTRByDomain();
    // biblored.gov.co: clicks=3, views=15 → CTR=0.2
    expect(result['biblored.gov.co']).toBeCloseTo(0.2, 3);
  });

  it('agrega correctamente múltiples actividades del mismo dominio', async () => {
    mocks.mockEventGroupBy
      .mockResolvedValueOnce([{ activityId: 'act-A', _count: { activityId: 3 } }])
      .mockResolvedValueOnce([
        { activityId: 'act-A', _count: { activityId: 6 } },
        { activityId: 'act-B', _count: { activityId: 4 } },
      ]);

    mocks.mockActivityFindMany.mockResolvedValue([
      { id: 'act-A', sourceUrl: 'https://idartes.gov.co/a' },
      { id: 'act-B', sourceUrl: 'https://idartes.gov.co/b' },
    ]);

    const result = await getCTRByDomain();
    // idartes.gov.co: clicks=3, views=10 → CTR=0.3
    expect(result['idartes.gov.co']).toBeCloseTo(0.3, 3);
  });

  it('retorna {} (fail-safe) si prisma lanza un error', async () => {
    mocks.mockEventGroupBy.mockRejectedValue(new Error('DB down'));
    const result = await getCTRByDomain();
    expect(result).toEqual({});
    expect(mocks.mockLogError).toHaveBeenCalled();
  });

  it('usa cache y no llama a prisma en la segunda llamada (TTL activo)', async () => {
    mocks.mockEventGroupBy.mockResolvedValue([]);
    await getCTRByDomain(); // primer call → llena cache
    await getCTRByDomain(); // segundo call → debe usar cache
    // groupBy se llama 2 veces en el primer call (clicks + views), nunca en el segundo
    expect(mocks.mockEventGroupBy).toHaveBeenCalledTimes(2);
  });

  it('excluye actividades sin sourceUrl válido', async () => {
    mocks.mockEventGroupBy
      .mockResolvedValueOnce([{ activityId: 'act-X', _count: { activityId: 5 } }])
      .mockResolvedValueOnce([{ activityId: 'act-X', _count: { activityId: 10 } }]);

    mocks.mockActivityFindMany.mockResolvedValue([
      { id: 'act-X', sourceUrl: null }, // URL inválida → getDomainFromUrl devuelve ''
    ]);

    const result = await getCTRByDomain();
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe('ctrToBoost()', () => {
  it('CTR > 0.3 → 0.15', () => expect(ctrToBoost(0.31)).toBe(0.15));
  it('CTR > 0.15 → 0.08', () => expect(ctrToBoost(0.16)).toBe(0.08));
  it('CTR > 0.05 → 0.03', () => expect(ctrToBoost(0.06)).toBe(0.03));
  it('CTR = 0 → 0', () => expect(ctrToBoost(0)).toBe(0));
  it('CTR < 0 → 0 (defensivo)', () => expect(ctrToBoost(-0.1)).toBe(0));
});
