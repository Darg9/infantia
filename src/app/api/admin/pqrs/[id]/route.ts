import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { UserRole } from '@/generated/prisma/client';
import { RESPONSE_CHANNELS } from '@/lib/pqrs';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const log = createLogger('api:admin:pqrs');

const VALID_STATUSES = ['received', 'in_progress', 'closed'] as const;

const patchSchema = z.object({
  status:           z.enum(VALID_STATUSES).optional(),
  responseChannel:  z.enum(RESPONSE_CHANNELS).optional(),
  firstRespondedAt: z.string().datetime().optional(),
});

// PATCH /api/admin/pqrs/:id
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole([UserRole.ADMIN]);

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { status, responseChannel, firstRespondedAt } = parsed.data;

  // Verificar que la PQRS existe
  const existing = await prisma.contactRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'PQRS no encontrada' }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (status) {
    updateData.status = status;
    updateData.statusChangedAt = new Date();
    if (status === 'closed') {
      updateData.resolvedAt = new Date();
    }
  }

  if (responseChannel) {
    updateData.responseChannel = responseChannel;
    // Si se establece canal de respuesta y aún no tiene firstRespondedAt, lo marcamos ahora
    if (!existing.firstRespondedAt && !firstRespondedAt) {
      updateData.firstRespondedAt = new Date();
    }
  }

  if (firstRespondedAt) {
    updateData.firstRespondedAt = new Date(firstRespondedAt);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const updated = await prisma.contactRequest.update({
    where: { id },
    data: updateData,
    select: {
      id:               true,
      status:           true,
      responseChannel:  true,
      firstRespondedAt: true,
      statusChangedAt:  true,
      resolvedAt:       true,
    },
  });

  log.info(`PQRS ${id} actualizada`, { status, responseChannel });

  return NextResponse.json(updated);
}
