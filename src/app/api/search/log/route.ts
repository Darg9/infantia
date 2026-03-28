// =============================================================================
// POST /api/search/log
// Registra una búsqueda con su conteo de resultados.
// Llamado desde Filters.tsx tras el debounce (q >= 2 chars).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { query, resultCount } = await req.json();
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await prisma.searchLog.create({
      data: {
        query:       query.trim().toLowerCase().slice(0, 300),
        resultCount: typeof resultCount === 'number' ? resultCount : 0,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
