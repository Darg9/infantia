// =============================================================================
// Tests: GET /api/activities/map
// =============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

const mockFindMany = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  prisma: {
    activity: { findMany: mockFindMany },
  },
}));

function makeReq(qs = '') {
  return new NextRequest(`http://localhost/api/activities/map${qs ? `?${qs}` : ''}`);
}

const SAMPLE = [
  {
    id: '1', title: 'Yoga Infantil',
    price: 0, priceCurrency: 'COP', pricePeriod: 'FREE',
    location: { name: 'Parque', neighborhood: 'Chapinero', latitude: 4.65, longitude: -74.05 },
    categories: [{ category: { name: 'Deporte' } }],
  },
  {
    id: '2', title: 'Taller de Pintura',
    price: 50000, priceCurrency: 'COP', pricePeriod: 'MONTHLY',
    location: { name: 'Biblioteca', neighborhood: null, latitude: 4.70, longitude: -74.07 },
    categories: [],
  },
  {
    id: '3', title: 'Sin ubicación',
    price: null, priceCurrency: 'COP', pricePeriod: null,
    // Sin location → debe ser filtrado
    location: null,
    categories: [],
  },
];

describe('GET /api/activities/map', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue(SAMPLE);
  });

  it('retorna 400 si no se provee cityId', async () => {
    const res  = await GET(makeReq()); // sin cityId
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/cityId is required/);
  });

  it('retorna markers correctamente formateados', async () => {
    const res  = await GET(makeReq('cityId=bogota-id'));
    const data = await res.json();
    expect(res.status).toBe(200);
    // La actividad sin location queda filtrada
    expect(data.markers).toHaveLength(2);
    expect(data.markers[0]).toMatchObject({
      id: '1', title: 'Yoga Infantil',
      lat: 4.65, lng: -74.05,
      category: 'Deporte',
      locationName: 'Chapinero',
      priceLabel: 'Gratis',
    });
    expect(data.markers[1]).toMatchObject({
      id: '2',
      locationName: 'Biblioteca', // fallback al name cuando no hay neighborhood
      priceLabel: expect.stringMatching(/50/),
    });
  });

  it('filtra actividades sin location (location=null)', async () => {
    const res  = await GET(makeReq('cityId=bogota-id'));
    const data = await res.json();
    expect(data.markers.find((m: any) => m.id === '3')).toBeUndefined();
  });

  it('llama a prisma con status=ACTIVE y take=500', async () => {
    await GET(makeReq('cityId=bogota-id'));
    const args = mockFindMany.mock.calls[0][0];
    expect(args.where.status).toBe('ACTIVE');
    expect(args.take).toBe(500);
  });

  it('aplica filtro type cuando es válido', async () => {
    await GET(makeReq('cityId=bogota-id&type=WORKSHOP'));
    const args = mockFindMany.mock.calls[0][0];
    expect(args.where.type).toBe('WORKSHOP');
  });

  it('ignora type inválido', async () => {
    await GET(makeReq('cityId=bogota-id&type=MALO'));
    const args = mockFindMany.mock.calls[0][0];
    expect(args.where.type).toBeUndefined();
  });

  it('aplica filtro audience KIDS incluyendo ALL', async () => {
    await GET(makeReq('cityId=bogota-id&audience=KIDS'));
    const args = mockFindMany.mock.calls[0][0];
    expect(args.where.audience.in).toEqual(expect.arrayContaining(['KIDS', 'ALL']));
  });

  it('aplica filtro de búsqueda en title y description', async () => {
    await GET(makeReq('cityId=bogota-id&search=yoga'));
    const args = mockFindMany.mock.calls[0][0];
    const searchCond = args.where.AND.find((c: any) => c.OR);
    expect(searchCond.OR[0].title.contains).toBe('yoga');
  });

  it('retorna 500 si prisma falla', async () => {
    mockFindMany.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeReq('cityId=bogota-id'));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('DB error');
  });
});
