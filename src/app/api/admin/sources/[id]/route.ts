import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { UserRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:sources');

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole([UserRole.ADMIN]);
  const { id } = await params;

  const body = await req.json();
  const { isActive } = body;

  if (typeof isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive debe ser boolean' }, { status: 400 });
  }

  const source = await prisma.scrapingSource.update({
    where: { id },
    data: { isActive },
    select: { id: true, name: true, isActive: true },
  });

  log.info(`Fuente ${source.name} → isActive=${source.isActive}`);
  return NextResponse.json(source);
}
