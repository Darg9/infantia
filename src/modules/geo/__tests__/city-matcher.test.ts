import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const { mockFindMany, mockFindUnique } = vi.hoisted(() => ({
  mockFindMany:  vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock('../../../lib/db', () => ({
  prisma: {
    city: {
      findMany:  mockFindMany,
      findUnique: mockFindUnique,
    },
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { matchCity, _resetCityCache, THRESHOLD_AUTO, THRESHOLD_REVIEW } from '../city-matcher';

// ── Ciudades de prueba ────────────────────────────────────────────────────────

const MOCK_CITIES = [
  { id: 'uuid-bogota',       name: 'Bogotá' },
  { id: 'uuid-medellin',     name: 'Medellín' },
  { id: 'uuid-cali',         name: 'Cali' },
  { id: 'uuid-barranquilla', name: 'Barranquilla' },
  { id: 'uuid-bucaramanga',  name: 'Bucaramanga' },
];

beforeEach(() => {
  vi.clearAllMocks();
  _resetCityCache();
  mockFindMany.mockResolvedValue(MOCK_CITIES);
});

describe('matchCity — casos MATCH (≥ 0.9)', () => {
  it('"Bogotá" → MATCH bogota (idéntico normalizado)', async () => {
    const result = await matchCity('Bogotá');
    expect(result.status).toBe('MATCH');
    if (result.status === 'MATCH') {
      expect(result.cityId).toBe('uuid-bogota');
      expect(result.score).toBeGreaterThanOrEqual(THRESHOLD_AUTO);
    }
  });

  it('"Bogota" (sin tilde) → MATCH bogota', async () => {
    const result = await matchCity('Bogota');
    expect(result.status).toBe('MATCH');
    if (result.status === 'MATCH') expect(result.cityId).toBe('uuid-bogota');
  });

  it('"BOGOTÁ" (mayúsculas) → MATCH bogota', async () => {
    const result = await matchCity('BOGOTÁ');
    expect(result.status).toBe('MATCH');
    if (result.status === 'MATCH') expect(result.cityId).toBe('uuid-bogota');
  });

  it('"Bogotá D.C." → MATCH bogota (sufijo eliminado)', async () => {
    const result = await matchCity('Bogotá D.C.');
    expect(result.status).toBe('MATCH');
    if (result.status === 'MATCH') expect(result.cityId).toBe('uuid-bogota');
  });

  it('"Medellín" → MATCH medellin', async () => {
    const result = await matchCity('Medellín');
    expect(result.status).toBe('MATCH');
    if (result.status === 'MATCH') expect(result.cityId).toBe('uuid-medellin');
  });

  it('"Medellin" (sin tilde) → MATCH medellin', async () => {
    const result = await matchCity('Medellin');
    expect(result.status).toBe('MATCH');
    if (result.status === 'MATCH') expect(result.cityId).toBe('uuid-medellin');
  });

  it('"Cali" → MATCH cali', async () => {
    const result = await matchCity('Cali');
    expect(result.status).toBe('MATCH');
    if (result.status === 'MATCH') expect(result.cityId).toBe('uuid-cali');
  });
});

describe('matchCity — casos REVIEW (0.75–0.9)', () => {
  it('input con typo menor puede caer en REVIEW o MATCH', async () => {
    // "Bogotá," → normaliza a "bogota" → debería ser MATCH
    const result = await matchCity('Bogotá,');
    expect(['MATCH', 'REVIEW']).toContain(result.status);
  });

  it('retorna score >= THRESHOLD_REVIEW cuando es REVIEW', async () => {
    // Forzamos un score intermedio usando una ciudad que no existe exactamente
    // pero es cercana — depende del set de ciudades mock
    const result = await matchCity('Bogotaa'); // typo de 1 char en 7 = ~0.86
    expect(result.score).toBeGreaterThanOrEqual(THRESHOLD_REVIEW);
  });
});

describe('matchCity — casos NEW (< 0.75)', () => {
  it('ciudad completamente distinta → NEW', async () => {
    const result = await matchCity('Tokio');
    expect(result.status).toBe('NEW');
    expect(result.score).toBeLessThan(THRESHOLD_REVIEW);
  });

  it('input vacío → NEW con score 0', async () => {
    const result = await matchCity('');
    expect(result.status).toBe('NEW');
    expect(result.score).toBe(0);
  });
});

describe('matchCity — caché de ciudades', () => {
  it('llama a findMany solo una vez por sesión', async () => {
    await matchCity('Bogotá');
    await matchCity('Medellín');
    await matchCity('Cali');
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it('después de _resetCityCache() vuelve a consultar BD', async () => {
    await matchCity('Bogotá');
    _resetCityCache();
    await matchCity('Cali');
    expect(mockFindMany).toHaveBeenCalledTimes(2);
  });
});

describe('matchCity — BD sin ciudades', () => {
  it('retorna NEW si no hay ciudades en BD', async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await matchCity('Bogotá');
    expect(result.status).toBe('NEW');
  });
});
