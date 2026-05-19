// =============================================================================
// POST /api/admin/cities/review/approve
// Marca la entrada como resuelta sin cambiar la ciudad sugerida.
// Body: { id: string (UUID) }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { UserRole } from '@/generated/prisma/client';

const approveSchema = z.object({
  id: z.string().uuid('id debe ser un UUID válido'),
});

export async function POST(req: NextRequest) {
  await requireRole([UserRole.ADMIN]);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }

  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? 'id requerido' }, { status: 400 });
  }

  await prisma.$executeRaw`
    UPDATE city_review_queue
    SET resolved = true
    WHERE id = ${parsed.data.id}::uuid
      AND resolved = false
  `;

  return NextResponse.json({ ok: true });
}
