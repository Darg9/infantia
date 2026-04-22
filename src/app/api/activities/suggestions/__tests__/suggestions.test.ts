// =============================================================================
// Tests: GET /api/activities/suggestions
// API mixta: actividades + categorías + ciudades, max 5, mínimo 3 chars
// Actividades usan $queryRaw (pg_trgm); categorías y ciudades usan findMany
// =============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockQueryRaw         = vi.hoisted(() => vi.fn());
const mockCategoryFindMany = vi.hoisted(() => vi.fn());
const mockCityFindMany     = vi.hoisted(() => vi.fn());
const mockSearchLogGroupBy = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw:         mockQueryRaw,
    category: { findMany: mockCategoryFindMany },
    city:     { findMany: mockCityFindMany     },
    searchLog:{ groupBy: mockSearchLogGroupBy  },
  },
}));

function makeRequest(q: string) {
  return new NextRequest(
    `http://localhost/api/activities/suggestions?q=${encodeURIComponent(q)}`,
  );
}

// ── Datos de ejemplo ──────────────────────────────────────────────────────────
// Shape devuelta por $queryRaw en la ruta: { id, title, cat_name, score }

const SAMPLE_ACT_ROWS = [
  { id: '1', title: 'Taller de Pintura', cat_name: 'Arte',  score: 0.8 },
  { id: '2', title: 'Taller de Música',  cat_name: null,    score: 0.6 },
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
    mockQueryRaw.mockResolvedValue(SAMPLE_ACT_ROWS);
    mockCategoryFindMany.mockResolvedValue(SAMPLE_CATEGORIES);
    mockCityFindMany.mockResolvedValue([]);
    mockSearchLogGroupBy.mockResolvedValue([]);
  });

  // ── Validación de longitud mínima ─────────────────────────────────────────

  it('retorna array vacío si q está vacío', async () => {
    const res  = await GET(makeRequest(''));
    const data = await res.json();
    expect(data.suggestions).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('retorna array vacío si q < 3 chars (1 char)', async () => {
    const res  = await GET(makeRequest('a'));
    const data = await res.json();
    expect(data.suggestions).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('retorna array vacío si q < 3 chars (2 chars)', async () => {
    const res  = await GET(makeRequest('ta'));
    const data = await res.json();
    expect(data.suggestions).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
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
      type:     'city',
      id:       'city1',
      label:    'Bogotá',
      sublabel: null,
    });
  });

  it('máximo 5 sugerencias en total', async () => {
    mockQueryRaw.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `a${i}`, title: `Taller ${i}`, cat_name: null, score: 1 - i * 0.05,
      })),
    );
    mockCategoryFindMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `c${i}`, name: `Talleres ${i}`, _count: { activities: 10 - i },
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
    const firstNonActivity = types.findIndex((t: string) => t !== 'activity');
    const lastActivity     = types.lastIndexOf('activity');
    if (firstNonActivity !== -1 && lastActivity !== -1) {
      expect(lastActivity).toBeLessThan(firstNonActivity);
    }
  });

  // ── Error ─────────────────────────────────────────────────────────────────

  it('retorna 500 si prisma falla', async () => {
    mockQueryRaw.mockRejectedValue(new Error('DB error'));
    const res  = await GET(makeRequest('yoga'));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('DB error');
  });
});
