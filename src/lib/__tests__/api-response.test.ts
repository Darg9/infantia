import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/server before importing the module under test
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init?) => ({ _data: data, _status: init?.status ?? 200 })),
  },
}));

import { successResponse, paginatedResponse, errorResponse } from '../api-response';
import { NextResponse } from 'next/server';

const mockJson = vi.mocked(NextResponse.json);

beforeEach(() => {
  mockJson.mockClear();
});

describe('successResponse', () => {
  it('llama a NextResponse.json con success:true y status 200 por defecto', () => {
    successResponse({ id: '1', name: 'Test' });
    expect(mockJson).toHaveBeenCalledWith(
      { success: true, data: { id: '1', name: 'Test' } },
      { status: 200 },
    );
  });

  it('respeta status personalizado', () => {
    successResponse({ created: true }, 201);
    expect(mockJson).toHaveBeenCalledWith(
      { success: true, data: { created: true } },
      { status: 201 },
    );
  });

  it('funciona con data array', () => {
    successResponse([1, 2, 3]);
    expect(mockJson).toHaveBeenCalledWith(
      { success: true, data: [1, 2, 3] },
      { status: 200 },
    );
  });
});

describe('paginatedResponse', () => {
  it('incluye data y pagination en la respuesta', () => {
    const data = [{ id: '1' }, { id: '2' }];
    const pagination = { page: 1, pageSize: 10, total: 50, totalPages: 5 };
    paginatedResponse(data, pagination);
    expect(mockJson).toHaveBeenCalledWith({ success: true, data, pagination });
  });

  it('funciona con array vacío', () => {
    const pagination = { page: 2, pageSize: 10, total: 5, totalPages: 1 };
    paginatedResponse([], pagination);
    expect(mockJson).toHaveBeenCalledWith({ success: true, data: [], pagination });
  });
});

describe('errorResponse', () => {
  it('devuelve error sin details', () => {
    errorResponse('Not found', 404);
    expect(mockJson).toHaveBeenCalledWith(
      { success: false, error: { message: 'Not found' } },
      { status: 404 },
    );
  });

  it('devuelve error con details cuando se proporciona', () => {
    errorResponse('Validation failed', 422, { field: 'email', reason: 'invalid' });
    expect(mockJson).toHaveBeenCalledWith(
      { success: false, error: { message: 'Validation failed', details: { field: 'email', reason: 'invalid' } } },
      { status: 422 },
    );
  });

  it('no incluye details si es undefined', () => {
    errorResponse('Internal error', 500, undefined);
    const call = mockJson.mock.calls[0][0] as { success: boolean; error: { message: string; details?: unknown } };
    expect(call.error.details).toBeUndefined();
  });

  it('details puede ser un objeto vacío', () => {
    errorResponse('Bad request', 400, {});
    const call = mockJson.mock.calls[0][0] as { success: boolean; error: { message: string; details?: unknown } };
    expect(call.error.details).toEqual({});
  });
});
