import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { UserRole, ScrapingPlatform, Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { z } from 'zod';

const log = createLogger('api:admin:sources');

// ─── GET — listar todas las fuentes ──────────────────────────────────────────
export async function GET() {
  await requireRole([UserRole.ADMIN]);

  const sources = await prisma.scrapingSource.findMany({
    orderBy: [{ isActive: 'desc' }, { platform: 'asc' }, { name: 'asc' }],
    select: {
      id:            true,
      name:          true,
      platform:      true,
      url:           true,
      isActive:      true,
      scheduleCron:  true,
      scraperType:   true,
      lastRunAt:     true,
      lastRunStatus: true,
      lastRunItems:  true,
      notes:         true,
      config:        true,
      city:          { select: { id: true, name: true } },
      vertical:      { select: { id: true, slug: true } },
    },
  });

  return NextResponse.json(sources);
}

// ─── POST — crear fuente nueva ────────────────────────────────────────────────
const createSchema = z.object({
  name:         z.string().min(2).max(255),
  platform:     z.nativeEnum(ScrapingPlatform),
  url:          z.string().url(),
  cityId:       z.string().uuid(),
  verticalId:   z.string().uuid(),
  scraperType:  z.string().min(1).max(50).default('cheerio'),
  scheduleCron: z.string().min(1).max(50).default('0 6 * * *'),
  isActive:     z.boolean().default(true),
  notes:        z.string().max(1000).optional(),
  config:       z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  await requireRole([UserRole.ADMIN]);

  const body = await req.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const source = await prisma.scrapingSource.create({
    data: {
      name:         d.name,
      platform:     d.platform,
      url:          d.url,
      scraperType:  d.scraperType,
      scheduleCron: d.scheduleCron,
      isActive:     d.isActive,
      notes:        d.notes,
      config:       d.config as Prisma.InputJsonValue | undefined,
      city:         { connect: { id: d.cityId } },
      vertical:     { connect: { id: d.verticalId } },
    },
    select: {
      id:       true,
      name:     true,
      platform: true,
      isActive: true,
      city:     { select: { id: true, name: true } },
      vertical: { select: { id: true, slug: true } },
    },
  });

  log.info(`Fuente creada: ${source.name} (${source.platform})`);
  return NextResponse.json(source, { status: 201 });
}
