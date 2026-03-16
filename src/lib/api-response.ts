// =============================================================================
// Infantia - Standardized API Response Helpers
// =============================================================================

import { NextResponse } from 'next/server';

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function paginatedResponse<T>(data: T[], pagination: Pagination) {
  return NextResponse.json({ success: true, data, pagination });
}

export function errorResponse(message: string, status: number, details?: unknown) {
  const error: { message: string; details?: unknown } = { message };
  if (details) error.details = details;
  return NextResponse.json({ success: false, error }, { status });
}
