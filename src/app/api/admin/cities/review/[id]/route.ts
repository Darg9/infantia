// =============================================================================
// DELETE /api/admin/cities/review/[id]
// Elimina la entrada de la cola (acción "Ignorar").
// No modifica ninguna Location ni City — solo limpia la cola.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { UserRole } from '@/generated/prisma/client';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  await requireRole([UserRole.ADMIN]);
  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  await prisma.$executeRaw`
    DELETE FROM city_review_queue
    WHERE id = ${id}::uuid
  `;

  return NextResponse.json({ ok: true });
}
