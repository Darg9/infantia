// =============================================================================
// GET /api/admin/cron/scrape
//
// Scheduler automático — Vercel Cron cada 6h.
// Paso 2: usa buildPredictivePlan() para asignar modos y respetar quota Gemini.
//
// Seguridad: header Authorization: Bearer <CRON_SECRET>
// El middleware deja pasar este path; la validación ocurre aquí.
//
// Idempotencia: jobId = sourceId en BullMQ → sin duplicados si el cron se
// dispara dos veces en el mismo ciclo.
//
// Flujo:
//   1. Fetch candidatas (pool ampliado 20) — las más antiguas primero.
//   2. Enriquecer con SourceStats (saveRate, avgCost, health) desde BD.
//   3. Consultar quota Gemini disponible.
//   4. buildPredictivePlan() asigna modo (DEEP/SURFACE/PING/PARSE_ONLY)
//      y estima coste por fuente respetando el presupuesto total.
//   5. Encolar solo las fuentes del plan, con maxPages según el modo.
//   6. Marcar lastRunAt solo para las fuentes planificadas.
// =============================================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { enqueueSourceJob } from '@/modules/scraping/queue/producer';
import { buildPredictivePlan } from '@/modules/scraping/scheduler/scheduler.core';
import type { SourceStats } from '@/modules/scraping/scheduler/scheduler.types';
import { quota } from '@/lib/quota-tracker';
import { createLogger } from '@/lib/logger';

const log = createLogger('cron:scrape');

// No re-encolar fuentes ejecutadas en las últimas 4h (margen de seguridad)
const MIN_INTERVAL_MS = 4 * 60 * 60 * 1000;
// Pool ampliado: el planner elige las mejores, no simplemente las 5 más viejas
const CANDIDATE_POOL = 20;
// Historial de logs recientes para calcular saveRate / avgCost
const LOG_LOOKBACK = 5;

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // ── Autenticación ──────────────────────────────────────────────────────────
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    log.warn('Intento no autorizado a cron/scrape');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const cutoff = new Date(Date.now() - MIN_INTERVAL_MS);

  // ── 1. Candidatas con logs recientes ──────────────────────────────────────
  const candidates = await prisma.scrapingSource.findMany({
    where: {
      isActive: true,
      OR: [
        { lastRunAt: null },           // nunca ejecutadas → máxima prioridad
        { lastRunAt: { lt: cutoff } }, // ejecutadas hace más de 4h
      ],
    },
    orderBy: { lastRunAt: 'asc' },
    take: CANDIDATE_POOL,
    select: {
      id:       true,
      name:     true,
      platform: true,
      url:      true,
      config:   true,
      city:     { select: { name: true } },
      vertical: { select: { slug: true } },
      logs: {
        orderBy: { startedAt: 'desc' },
        take:    LOG_LOOKBACK,
        select:  { itemsFound: true, itemsNew: true, status: true },
      },
    },
  });

  if (candidates.length === 0) {
    log.info('Cron scrape: sin fuentes elegibles', { action: 'cron_scrape', enqueued: 0 });
    return NextResponse.json({ enqueued: 0, skipped: 0, planned: 0 });
  }

  // ── 2. SourceHealth para health score ─────────────────────────────────────
  const hostnames = candidates
    .map((s) => { try { return new URL(s.url).hostname; } catch { return ''; } })
    .filter(Boolean);

  const healthRecords = await prisma.sourceHealth.findMany({
    where:  { source: { in: hostnames } },
    select: { source: true, score: true },
  });
  const healthMap = new Map(healthRecords.map((h) => [h.source, h.score]));

  // ── 3. Quota Gemini disponible ─────────────────────────────────────────────
  const totalBudget = await quota.getRemaining();

  if (totalBudget === 0) {
    log.warn('Cron scrape: quota Gemini agotada, nada encolado', { action: 'cron_scrape' });
    return NextResponse.json({
      enqueued: 0,
      skipped:  candidates.length,
      planned:  0,
      reason:   'quota_exhausted',
    });
  }

  // ── 4. Construir SourceStats ───────────────────────────────────────────────
  const sourcesWithStats = candidates.map((s) => {
    const hostname = (() => { try { return new URL(s.url).hostname; } catch { return ''; } })();
    const recentLogs = s.logs ?? [];

    // saveRate: promedio de (itemsNew / max(itemsFound, 1)) en últimas runs
    const saveRate =
      recentLogs.length > 0
        ? recentLogs.reduce((acc, l) => acc + l.itemsNew / Math.max(l.itemsFound, 1), 0) /
          recentLogs.length
        : 0.1; // default neutral para fuentes sin historial

    // avgCost: proxy = avg(itemsFound) en últimas runs
    // (estimateCost usa maxUrls; itemsFound ≈ URLs relevantes procesadas)
    const avgCost =
      recentLogs.length > 0
        ? recentLogs.reduce((acc, l) => acc + l.itemsFound, 0) / recentLogs.length
        : 15; // default: coste equivalente a SURFACE

    // health: score de SourceHealth (0–1); 0.5 si no hay registro aún
    const health = healthMap.get(hostname) ?? 0.5;

    const stats: SourceStats = {
      sourceId:     s.id,
      ctr7d:        0,    // sin tabla CTR por fuente todavía
      saveRate,
      health,
      avgCost,
      reparseCount: 0,    // needsReparse no existe en schema aún
      isGov:        hostname.includes('.gov.'),
    };

    return { source: s, stats };
  });

  // ── 5. Plan predictivo ────────────────────────────────────────────────────
  const { planned, skipped, budgetUsed } = buildPredictivePlan(sourcesWithStats, totalBudget);

  if (planned.length === 0) {
    log.info('Cron scrape: plan vacío (budget insuficiente o todas degradadas)', {
      action:   'cron_scrape',
      skipped:  skipped.length,
      budget:   totalBudget,
    });
    return NextResponse.json({
      enqueued: 0,
      planned:  0,
      skipped:  skipped.length,
      budgetUsed: 0,
    });
  }

  // ── 6. Marcar lastRunAt solo para las fuentes planificadas ─────────────────
  const plannedIds = planned.map((p) => p.source.id as string);
  await prisma.scrapingSource.updateMany({
    where: { id: { in: plannedIds } },
    data:  { lastRunAt: new Date() },
  });

  // ── 7. Encolado con maxPages según el modo ────────────────────────────────
  const results = await Promise.allSettled(
    planned.map((p) =>
      enqueueSourceJob({
        sourceId:     p.source.id,
        url:          p.source.url,
        platform:     p.source.platform,
        cityName:     p.source.city.name,
        verticalSlug: p.source.vertical.slug,
        // PARSE_ONLY tiene maxUrls=Infinity → no pasar maxPages (usa default del worker)
        ...(p.maxUrls !== Infinity ? { maxPages: p.maxUrls } : {}),
      }),
    ),
  );

  const enqueued = results.filter((r) => r.status === 'fulfilled').length;
  const failed   = results.filter((r) => r.status === 'rejected').length;

  log.info('Cron scrape (predictivo) ejecutado', {
    action:      'cron_scrape_predictive',
    candidates:  candidates.length,
    planned:     planned.length,
    skippedCount: skipped.length,
    enqueued,
    failed,
    budgetUsed,
    budgetTotal: totalBudget,
    plan:        planned.map((p) => `${p.source.name} [${p.mode}]`),
    skippedSources: skipped.map((s) => `${s.source.name}: ${s.reason}`),
  });

  if (failed > 0) {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        log.error(`Error encolando fuente ${planned[i]?.source.name}`, {
          error: r.reason instanceof Error ? r.reason : new Error(String(r.reason)),
        });
      }
    });
  }

  return NextResponse.json({
    enqueued,
    failed,
    planned:     planned.length,
    skipped:     skipped.length,
    budgetUsed,
    budgetTotal: totalBudget,
    plan: planned.map((p) => ({
      source:        p.source.name,
      mode:          p.mode,
      maxUrls:       p.maxUrls === Infinity ? null : p.maxUrls,
      estimatedCost: p.estimatedCost,
    })),
  });
}
