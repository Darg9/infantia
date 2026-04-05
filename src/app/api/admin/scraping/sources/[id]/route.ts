// PATCH /api/admin/scraping/sources/[id] — Actualizar config de una fuente de scraping
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { UserRole } from '@/generated/prisma/client';
import type { Prisma } from '@/generated/prisma/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:scraping:sources');

const UpdateSourceSchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole([UserRole.ADMIN]);
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const parsed = UpdateSourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });
  }

  const source = await prisma.scrapingSource.findUnique({ where: { id } });
  if (!source) {
    return NextResponse.json({ error: 'Fuente no encontrada' }, { status: 404 });
  }

  const data: Prisma.ScrapingSourceUpdateInput = {};
  if (parsed.data.config !== undefined) data.config = parsed.data.config as Prisma.InputJsonValue;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

  const updated = await prisma.scrapingSource.update({ where: { id }, data });

  log.info('Fuente actualizada', { id, changes: parsed.data });
  return NextResponse.json(updated);
}
