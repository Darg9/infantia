// =============================================================================
// Tests: GET /api/activities/suggestions
// API mixta: actividades + categorías + ciudades, max 5, mínimo 3 chars
// =============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockActivityFindMany  = vi.hoisted(() => vi.fn());
const mockCategoryFindMany  = vi.hoisted(() => vi.fn());
const mockCityFindMany      = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  prisma: {
    activity: { findMany: mockActivityFindMany },
    category: { findMany: mockCategoryFindMany },
    city:     { findMany: mockCityFindMany     },
  },
}));

function makeRequest(q: string) {
  return new NextRequest(
    `http://localhost/api/activities/suggestions?q=${encodeURIComponent(q)}`,
  );
}

// ── Datos de ejemplo ──────────────────────────────────────────────────────────

const SAMPLE_ACTIVITIES = [
  {
    id: '1',
    title: 'Taller de Pintura',
    sourceConfidence: 0.9,
    categories: [{ category: { name: 'Arte' } }],
  },
  {
    id: '2',
    title: 'Taller de Música',
    sourceConfidence: 0.7,
    categories: [],
  },
];

const SAMPLE_CATEGORIES = [
  { id: 'cat1', name: 'Talleres', _count: { activities: 15 } },
];

const SAMPLE_CITIES = [
  { id: 'city1', name: 'Bogotá' },
];

describe('GET /api/activities/suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivityFindMany.mockResolvedValue(SAMPLE_ACTIVITIES);
    mockCategoryFindMany.mockResolvedValue(SAMPLE_CATEGORIES);
    mockCityFindMany.mockResolvedValue([]);
  });

  // ── Validación de longitud mínima ─────────────────────────────────────────

  it('retorna array vacío si q está vacío', async () => {
    const res  = await GET(makeRequest(''));
    const data = await res.json();
    expect(data.suggestions).toEqual([]);
    expect(mockActivityFindMany).not.toHaveBeenCalled();
  });

  it('retorna array vacío si q < 3 chars (1 char)', async () => {
    const res  = await GET(makeRequest('a'));
    const data = await res.json();
    expect(data.suggestions).toEqual([]);
    expect(mockActivityFindMany).not.toHaveBeenCalled();
  });

  it('retorna array vacío si q < 3 chars (2 chars)', async () => {
    const res  = await GET(makeRequest('ta'));
    const data = await res.json();
    expect(data.suggestions).toEqual([]);
    expect(mockActivityFindMany).not.toHaveBeenCalled();
  });

  // ── Resultados ────────────────────────────────────────────────────────────

  it('retorna sugerencias con q >= 3 chars', async () => {
    const res  = await GET(makeRequest('tal'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.suggestions)).toBe(true);
  });

  it('devuelve actividades con formato correcto (type, id, label, sublabel)', async () => {
    const res  = await GET(makeRequest('taller'));
    const data = await res.json();
    const activities = data.suggestions.filter((s: { type: string }) => s.type === 'activity');
    expect(activities.length).toBeGreaterThan(0);
    expect(activities[0]).toMatchObject({
      type:     'activity',
      id:       '1',
      label:    'Taller de Pintura',
      sublabel: 'Arte',
    });
  });

  it('sublabel null cuando la actividad no tiene categoría', async () => {
    const res  = await GET(makeRequest('taller'));
    const data = await res.json();
    const music = data.suggestions.find((s: { label: string }) => s.label === 'Taller de Música');
    expect(music?.sublabel).toBeNull();
  });

  it('devuelve categorías con formato correcto', async () => {
    const res  = await GET(makeRequest('tal'));
    const data = await res.json();
    const cats = data.suggestions.filter((s: { type: string }) => s.type === 'category');
    expect(cats[0]).toMatchObject({
      type:  'category',
      id:    'cat1',
      label: 'Talleres',
    });
    expect(cats[0].sublabel).toMatch(/15 actividades/);
  });

  it('devuelve ciudades con formato correcto', async () => {
    mockCityFindMany.mockResolvedValue(SAMPLE_CITIES);
    const res  = await GET(makeRequest('bog'));
    const data = await res.json();
    const cities = data.suggestions.filter((s: { type: string }) => s.type === 'city');
    expect(cities[0]).toMatchObject({
      type:    'city',
      id:      'city1',
      label:   'Bogotá',
      sublabel: null,
    });
  });

  it('máximo 5 sugerencias en total', async () => {
    // Devolver muchas actividades y categorías
    mockActivityFindMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `a${i}`,
        title: `Taller ${i}`,
        sourceConfidence: 1 - i * 0.1,
        categories: [],
      })),
    );
    mockCategoryFindMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `c${i}`,
        name: `Talleres ${i}`,
        _count: { activities: 10 - i },
      })),
    );
    const res  = await GET(makeRequest('taller'));
    const data = await res.json();
    expect(data.suggestions.length).toBeLessThanOrEqual(5);
  });

  it('orden: actividades primero, luego categorías, luego ciudades', async () => {
    mockCityFindMany.mockResolvedValue(SAMPLE_CITIES);
    const res  = await GET(makeRequest('taller'));
    const data = await res.json();
    const types = data.suggestions.map((s: { type: string }) => s.type);
    // Activities appear before categories and cities
    const firstCatOrCity = types.findIndex((t: string) => t !== 'activity');
    const lastActivity   = types.lastIndexOf('activity');
    if (firstCatOrCity !== -1 && lastActivity !== -1) {
      expect(lastActivity).toBeLessThan(firstCatOrCity);
    }
  });

  // ── Error ─────────────────────────────────────────────────────────────────

  it('retorna 500 si prisma falla', async () => {
    mockActivityFindMany.mockRejectedValue(new Error('DB error'));
    const res  = await GET(makeRequest('yoga'));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('DB error');
  });
});
