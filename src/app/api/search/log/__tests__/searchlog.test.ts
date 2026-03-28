// =============================================================================
// Tests: POST /api/search/log
// =============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  prisma: { searchLog: { create: mockCreate } },
}));

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/search/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/search/log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'sl-1' });
  });

  it('registra una búsqueda válida', async () => {
    const res  = await POST(makeReq({ query: 'yoga', resultCount: 5 }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith({
      data: { query: 'yoga', resultCount: 5 },
    });
  });

  it('normaliza el query a minúsculas y trim', async () => {
    await POST(makeReq({ query: '  YOGA  ', resultCount: 3 }));
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.query).toBe('yoga');
  });

  it('usa resultCount=0 por defecto si no se pasa', async () => {
    await POST(makeReq({ query: 'teatro' }));
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.resultCount).toBe(0);
  });

  it('retorna 400 si query < 2 chars', async () => {
    const res = await POST(makeReq({ query: 'a', resultCount: 0 }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('retorna 400 si query está vacío', async () => {
    const res = await POST(makeReq({ query: '', resultCount: 0 }));
    expect(res.status).toBe(400);
  });

  it('retorna 400 si query no es string', async () => {
    const res = await POST(makeReq({ query: 123, resultCount: 0 }));
    expect(res.status).toBe(400);
  });

  it('retorna 500 si prisma falla', async () => {
    mockCreate.mockRejectedValue(new Error('DB error'));
    const res = await POST(makeReq({ query: 'yoga', resultCount: 2 }));
    expect(res.status).toBe(500);
  });
});
