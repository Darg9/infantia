// =============================================================================
// POST /api/search/log
// Registra una búsqueda con su conteo de resultados.
// Llamado desde Filters.tsx tras el debounce (q >= 2 chars).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { checkRateLimit, getIP, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

const searchLogSchema = z.object({
  query:       z.string().min(2).max(300),
  resultCount: z.number().int().min(0).default(0),
});

export async function POST(req: NextRequest) {
  // Rate limiting — 60 req/min por IP (analytics de búsqueda)
  const rl = await checkRateLimit(getIP(req), RATE_LIMITS.searchLog);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = searchLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await prisma.searchLog.create({
      data: {
        query:       parsed.data.query.trim().toLowerCase(),
        resultCount: parsed.data.resultCount,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
