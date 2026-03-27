// =============================================================================
// Tests: GET /api/activities/suggestions
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

function makeRequest(q: string) {
  return new NextRequest(`http://localhost/api/activities/suggestions?q=${encodeURIComponent(q)}`);
}

const SAMPLE = [
  { id: '1', title: 'Taller de Pintura', categories: [{ category: { name: 'Arte' } }] },
  { id: '2', title: 'Taller de Música', categories: [] },
];

describe('GET /api/activities/suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue(SAMPLE);
  });

  it('retorna array vacío si q < 2 chars', async () => {
    const res = await GET(makeRequest('a'));
    const data = await res.json();
    expect(data.suggestions).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('retorna array vacío si q está vacío', async () => {
    const res = await GET(makeRequest(''));
    const data = await res.json();
    expect(data.suggestions).toEqual([]);
  });

  it('retorna sugerencias con q >= 2 chars', async () => {
    const res = await GET(makeRequest('taller'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.suggestions).toHaveLength(2);
    expect(data.suggestions[0]).toMatchObject({ id: '1', title: 'Taller de Pintura', category: 'Arte' });
    expect(data.suggestions[1]).toMatchObject({ id: '2', title: 'Taller de Música', category: null });
  });

  it('llama a prisma con los parámetros correctos', async () => {
    await GET(makeRequest('yoga'));
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE' }),
        take: 6,
        orderBy: { sourceConfidence: 'desc' },
      })
    );
  });

  it('retorna 500 si prisma falla', async () => {
    mockFindMany.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeRequest('yoga'));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('DB error');
  });
});
