// =============================================================================
// Tests: lib/cities.ts — getCitiesForSelector
//
// Lógica de negocio crítica: dual-count (strictCount gate + orCount visible),
// filtro de badDomains y transformación de tipos Prisma → CityOption.
//
// Estrategia: mock del singleton prisma de lib/db para testear sin BD real.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks con vi.hoisted ──────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const mockCityFindMany    = vi.fn();
  const mockSourceFindMany  = vi.fn();
  const mockActivityCount   = vi.fn();

  return { mockCityFindMany, mockSourceFindMany, mockActivityCount };
});

vi.mock('../../lib/db', () => ({
  prisma: {
    city:         { findMany: mocks.mockCityFindMany },
    sourceHealth: { findMany: mocks.mockSourceFindMany },
    activity:     { count:    mocks.mockActivityCount },
  },
}));

// buildActivityWhere es una función pura — no necesita mock
import { getCitiesForSelector } from '../../lib/cities';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const BOG = {
  id: 'city-bog',
  name: 'Bogotá',
  defaultLat: 4.711,
  defaultLng: -74.0721,
  defaultZoom: 12,
};

const MED = {
  id: 'city-med',
  name: 'Medellín',
  defaultLat: 6.2442,
  defaultLng: -75.5812,
  defaultZoom: 12,
};

// =============================================================================
// Gate: strictCount ≥ 1 — ciudades fantasma excluidas
// =============================================================================
describe('getCitiesForSelector — gate strictCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('excluye ciudades donde strictCount = 0 (ciudad fantasma)', async () => {
    mocks.mockCityFindMany.mockResolvedValue([BOG]);
    mocks.mockSourceFindMany.mockResolvedValue([]);
    // strictCount = 0, orCount = 5
    mocks.mockActivityCount
      .mockResolvedValueOnce(0)  // strictCount BOG
      .mockResolvedValueOnce(5); // orCount BOG

    const result = await getCitiesForSelector();
    expect(result).toHaveLength(0);
  });

  it('incluye ciudad donde strictCount ≥ 1', async () => {
    mocks.mockCityFindMany.mockResolvedValue([BOG]);
    mocks.mockSourceFindMany.mockResolvedValue([]);
    mocks.mockActivityCount
      .mockResolvedValueOnce(3)  // strictCount BOG
      .mockResolvedValueOnce(10); // orCount BOG

    const result = await getCitiesForSelector();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('city-bog');
  });

  it('filtra solo las ciudades fantasma — mantiene las que tienen supply', async () => {
    mocks.mockCityFindMany.mockResolvedValue([BOG, MED]);
    mocks.mockSourceFindMany.mockResolvedValue([]);
    mocks.mockActivityCount
      .mockResolvedValueOnce(5)  // strictCount BOG ✓
      .mockResolvedValueOnce(20) // orCount BOG
      .mockResolvedValueOnce(0)  // strictCount MED ✗ (fantasma)
      .mockResolvedValueOnce(3); // orCount MED (no importa — se filtra)

    const result = await getCitiesForSelector();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('city-bog');
  });
});

// =============================================================================
// activityCount visible = orCount (no strictCount)
// =============================================================================
describe('getCitiesForSelector — activityCount usa orCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('el activityCount visible es orCount, no strictCount', async () => {
    mocks.mockCityFindMany.mockResolvedValue([BOG]);
    mocks.mockSourceFindMany.mockResolvedValue([]);
    mocks.mockActivityCount
      .mockResolvedValueOnce(3)   // strictCount (gate)
      .mockResolvedValueOnce(42); // orCount (número visible)

    const [city] = await getCitiesForSelector();
    expect(city.activityCount).toBe(42);
  });
});

// =============================================================================
// Transformación de tipos — Prisma Decimal → Number
// =============================================================================
describe('getCitiesForSelector — tipos de salida', () => {
  beforeEach(() => vi.clearAllMocks());

  it('defaultLat y defaultLng se convierten a Number (desde Prisma Decimal)', async () => {
    const cityWithDecimal = {
      ...BOG,
      defaultLat: { toNumber: () => 4.711 } as any, // simula Prisma Decimal
      defaultLng: { toNumber: () => -74.0721 } as any,
    };
    mocks.mockCityFindMany.mockResolvedValue([cityWithDecimal]);
    mocks.mockSourceFindMany.mockResolvedValue([]);
    mocks.mockActivityCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(10);

    const [city] = await getCitiesForSelector();
    // Number() sobre un Decimal de Prisma llama .valueOf() — verificamos que sea numérico
    expect(typeof city.defaultLat).toBe('number');
    expect(typeof city.defaultLng).toBe('number');
  });

  it('retorna los campos correctos en cada CityOption', async () => {
    mocks.mockCityFindMany.mockResolvedValue([BOG]);
    mocks.mockSourceFindMany.mockResolvedValue([]);
    mocks.mockActivityCount
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(15);

    const [city] = await getCitiesForSelector();
    expect(city).toMatchObject({
      id:           'city-bog',
      name:         'Bogotá',
      defaultZoom:  12,
      activityCount: 15,
    });
  });
});

// =============================================================================
// Sin ciudades activas — retorna array vacío
// =============================================================================
describe('getCitiesForSelector — sin ciudades', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna [] si no hay ciudades activas en BD', async () => {
    mocks.mockCityFindMany.mockResolvedValue([]);
    mocks.mockSourceFindMany.mockResolvedValue([]);

    const result = await getCitiesForSelector();
    expect(result).toEqual([]);
    expect(mocks.mockActivityCount).not.toHaveBeenCalled();
  });

  it('retorna [] si todas las ciudades son fantasma (strictCount = 0)', async () => {
    mocks.mockCityFindMany.mockResolvedValue([BOG, MED]);
    mocks.mockSourceFindMany.mockResolvedValue([]);
    mocks.mockActivityCount.mockResolvedValue(0); // strictCount = 0 para todas

    const result = await getCitiesForSelector();
    expect(result).toEqual([]);
  });
});

// =============================================================================
// badDomains — integración con filtro de calidad
// =============================================================================
describe('getCitiesForSelector — badDomains', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pasa badDomains al orCount (buildActivityWhere) cuando hay fuentes degradadas', async () => {
    mocks.mockCityFindMany.mockResolvedValue([BOG]);
    mocks.mockSourceFindMany.mockResolvedValue([{ source: 'spam.com' }]);
    mocks.mockActivityCount
      .mockResolvedValueOnce(5)  // strictCount
      .mockResolvedValueOnce(8); // orCount — con badDomains excluidos

    const [city] = await getCitiesForSelector();
    // Si badDomains se aplica correctamente, el orCount = 8 (no el total sin filtrar)
    expect(city.activityCount).toBe(8);

    // Verificar que activity.count se llamó (strictCount + orCount)
    expect(mocks.mockActivityCount).toHaveBeenCalledTimes(2);
  });

  it('sin fuentes degradadas badDomains es array vacío — no afecta el filtro OR', async () => {
    mocks.mockCityFindMany.mockResolvedValue([BOG]);
    mocks.mockSourceFindMany.mockResolvedValue([]); // sin bad domains
    mocks.mockActivityCount
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(20);

    const [city] = await getCitiesForSelector();
    expect(city.activityCount).toBe(20);
    expect(mocks.mockActivityCount).toHaveBeenCalledTimes(2);
  });
});

// =============================================================================
// Múltiples ciudades — orden preservado
// =============================================================================
describe('getCitiesForSelector — múltiples ciudades', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna todas las ciudades con strictCount ≥ 1 en el orden que llegan de BD', async () => {
    mocks.mockCityFindMany.mockResolvedValue([BOG, MED]);
    mocks.mockSourceFindMany.mockResolvedValue([]);
    mocks.mockActivityCount
      .mockResolvedValueOnce(10) // strictCount BOG
      .mockResolvedValueOnce(50) // orCount BOG
      .mockResolvedValueOnce(3)  // strictCount MED
      .mockResolvedValueOnce(12); // orCount MED

    const result = await getCitiesForSelector();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('city-bog');
    expect(result[0].activityCount).toBe(50);
    expect(result[1].id).toBe('city-med');
    expect(result[1].activityCount).toBe(12);
  });
});
