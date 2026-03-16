// =============================================================================
// Tests: lib/validation.ts
// =============================================================================

import { describe, it, expect } from 'vitest';
import { uuidSchema, paginationSchema, parsePagination } from '../validation';

describe('uuidSchema', () => {
  it('acepta UUID v4 válido', () => {
    const result = uuidSchema.safeParse('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(result.success).toBe(true);
  });

  it('rechaza string no UUID', () => {
    expect(uuidSchema.safeParse('no-es-uuid').success).toBe(false);
  });

  it('rechaza string vacío', () => {
    expect(uuidSchema.safeParse('').success).toBe(false);
  });

  it('rechaza número', () => {
    expect(uuidSchema.safeParse(123).success).toBe(false);
  });
});

describe('paginationSchema', () => {
  it('usa page=1 y pageSize=20 por defecto', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it('convierte strings a números (query params)', () => {
    const result = paginationSchema.safeParse({ page: '3', pageSize: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(50);
    }
  });

  it('rechaza page < 1', () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('rechaza page negativa', () => {
    expect(paginationSchema.safeParse({ page: -5 }).success).toBe(false);
  });

  it('rechaza pageSize > MAX_PAGE_SIZE (100)', () => {
    expect(paginationSchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it('acepta pageSize en el límite exacto (100)', () => {
    const result = paginationSchema.safeParse({ pageSize: 100 });
    expect(result.success).toBe(true);
  });

  it('rechaza pageSize < 1', () => {
    expect(paginationSchema.safeParse({ pageSize: 0 }).success).toBe(false);
  });
});

describe('parsePagination()', () => {
  const makeParams = (obj: Record<string, string>) => new URLSearchParams(obj);

  it('retorna page, pageSize y skip calculado', () => {
    const result = parsePagination(makeParams({ page: '2', pageSize: '10' }));
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.skip).toBe(10); // (2-1) * 10
  });

  it('skip es 0 en la primera página', () => {
    const result = parsePagination(makeParams({}));
    expect(result.skip).toBe(0);
  });

  it('calcula skip correctamente para página 5 con pageSize 20', () => {
    const result = parsePagination(makeParams({ page: '5', pageSize: '20' }));
    expect(result.skip).toBe(80); // (5-1) * 20
  });

  it('usa defaults cuando no hay params', () => {
    const result = parsePagination(new URLSearchParams());
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.skip).toBe(0);
  });
});
