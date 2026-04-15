// =============================================================================
// GET /api/admin/cron/scrape
//
// Endpoint de scheduler automático — llamado por Vercel Cron cada 6 horas.
// Encola hasta 5 fuentes activas priorizando las menos recientemente ejecutadas.
//
// Seguridad: header Authorization: Bearer <CRON_SECRET>
// El middleware deja pasar este path; la validación ocurre aquí.
//
// Idempotencia: jobId = sourceId en BullMQ → sin duplicados si el cron se
// dispara dos veces en el mismo ciclo.
//
// Límite: 5 fuentes/ciclo × 4 ciclos/día = 20 jobs/día (respeta quota Gemini)
// =============================================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { enqueueSourceJob } from '@/modules/scraping/queue/producer';
import { createLogger } from '@/lib/logger';

const log = createLogger('cron:scrape');

const SOURCES_PER_RUN = 5;
// No re-encolar fuentes ejecutadas en las últimas 4h (margen de seguridad)
const MIN_INTERVAL_MS = 4 * 60 * 60 * 1000;

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // ── Autenticación ──────────────────────────────────────────────────────────
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    log.warn('Intento no autorizado a cron/scrape');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const cutoff = new Date(Date.now() - MIN_INTERVAL_MS);

  // ── Selección de fuentes ───────────────────────────────────────────────────
  const sources = await prisma.scrapingSource.findMany({
    where: {
      isActive: true,
      OR: [
        { lastRunAt: null },              // nunca ejecutadas → máxima prioridad
        { lastRunAt: { lt: cutoff } },    // ejecutadas hace más de 4h
      ],
    },
    orderBy: { lastRunAt: 'asc' },        // las más viejas primero
    take: SOURCES_PER_RUN,
    select: {
      id:          true,
      name:        true,
      platform:    true,
      url:         true,
      config:      true,
      city:        { select: { name: true } },
      vertical:    { select: { slug: true } },
    },
  });

  if (sources.length === 0) {
    log.info('Cron scrape: sin fuentes elegibles', { action: 'cron_scrape', enqueued: 0 });
    return NextResponse.json({ enqueued: 0, skipped: 0 });
  }

  // ── Encolado ───────────────────────────────────────────────────────────────
  const results = await Promise.allSettled(
    sources.map((s) =>
      enqueueSourceJob({
        sourceId:     s.id,
        url:          s.url,
        platform:     s.platform,
        cityName:     s.city.name,
        verticalSlug: s.vertical.slug,
      }),
    ),
  );

  const enqueued = results.filter((r) => r.status === 'fulfilled').length;
  const failed   = results.filter((r) => r.status === 'rejected').length;

  log.info('Cron scrape ejecutado', {
    action:   'cron_scrape',
    total:    sources.length,
    enqueued,
    failed,
    sources:  sources.map((s) => s.name),
  });

  if (failed > 0) {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        log.error(`Error encolando fuente ${sources[i].name}`, {
          error: r.reason instanceof Error ? r.reason : new Error(String(r.reason)),
        });
      }
    });
  }

  return NextResponse.json({ enqueued, failed, total: sources.length });
}
