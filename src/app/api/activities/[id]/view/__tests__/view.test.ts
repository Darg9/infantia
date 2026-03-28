// =============================================================================
// Tests: POST /api/activities/[id]/view
// =============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  prisma: { activityView: { create: mockCreate } },
}));

function makeReq(id: string) {
  return {
    req: new NextRequest('http://localhost/api/activities/view', { method: 'POST' }),
    params: Promise.resolve({ id }),
  };
}

describe('POST /api/activities/[id]/view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'v1' });
  });

  it('crea un ActivityView con el activityId correcto', async () => {
    const { req, params } = makeReq('act-123');
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith({
      data: { activityId: 'act-123' },
    });
  });

  it('retorna 400 si id está vacío', async () => {
    const { req, params } = makeReq('');
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('retorna 500 (ok:false) si prisma falla — sin lanzar excepción', async () => {
    mockCreate.mockRejectedValue(new Error('DB error'));
    const { req, params } = makeReq('act-123');
    const res = await POST(req, { params });
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });
});
