// =============================================================================
// POST /api/admin/cities/review/reassign
// Cambia la ciudad sugerida y marca como resuelta.
// Body: { id: string, cityId: string }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id, cityId } = body as { id?: string; cityId?: string };

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }
  if (!cityId || typeof cityId !== 'string') {
    return NextResponse.json({ error: 'cityId requerido' }, { status: 400 });
  }

  // Verificar que la ciudad existe antes de asignar
  const city = await prisma.city.findUnique({
    where: { id: cityId },
    select: { id: true },
  });

  if (!city) {
    return NextResponse.json({ error: 'Ciudad no encontrada' }, { status: 404 });
  }

  await prisma.$executeRaw`
    UPDATE city_review_queue
    SET resolved = true,
        suggested_city_id = ${cityId}
    WHERE id = ${id}::uuid
      AND resolved = false
  `;

  return NextResponse.json({ ok: true });
}
