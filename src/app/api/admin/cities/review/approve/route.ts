// =============================================================================
// POST /api/admin/cities/review/approve
// Marca la entrada como resuelta sin cambiar la ciudad sugerida.
// Body: { id: string }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id } = body as { id?: string };

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  await prisma.$executeRaw`
    UPDATE city_review_queue
    SET resolved = true
    WHERE id = ${id}::uuid
      AND resolved = false
  `;

  return NextResponse.json({ ok: true });
}
