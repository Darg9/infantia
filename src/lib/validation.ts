// =============================================================================
// HabitaPlan - Shared Validation Utilities
// =============================================================================

import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/config/constants';

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export function parsePagination(searchParams: URLSearchParams) {
  const parsed = paginationSchema.parse({
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
  });
  return { ...parsed, skip: (parsed.page - 1) * parsed.pageSize };
}
