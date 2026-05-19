import { getErrorMessage } from '../../lib/error';
import { prisma } from '@/lib/db';
import { getDomainFromUrl } from '@/modules/activities/ranking';
import { createLogger } from '@/lib/logger';

const log = createLogger('analytics:metrics');

// Cache en memoria con TTL 5 minutos (mismo patrón que activities.service.ts)
let ctrCache: { data: Record<string, number>; expiresAt: number } | null = null;
const CTR_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Calcula el CTR real por dominio a partir de eventos de los últimos 30 días.
 *
 * CTR = outbound_clicks / activity_views por dominio de fuente.
 * Requiere JOIN: Event.activityId → Activity.sourceUrl → extractDomain()
 *
 * Retorna {} (no lanza) si falla la query — fail-safe por diseño.
 */
export async function getCTRByDomain(): Promise<Record<string, number>> {
  const now = Date.now();
  if (ctrCache && now < ctrCache.expiresAt) return ctrCache.data;

  try {
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    // 1 query por tipo de evento — agrupado por activityId
    const [clicks, views] = await Promise.all([
      prisma.event.groupBy({
        by: ['activityId'],
        where: {
          type: 'outbound_click',
          activityId: { not: null },
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: { activityId: true },
      }),
      prisma.event.groupBy({
        by: ['activityId'],
        where: {
          type: 'activity_view',
          activityId: { not: null },
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: { activityId: true },
      }),
    ]);

    if (views.length === 0) {
      ctrCache = { data: {}, expiresAt: now + CTR_CACHE_TTL_MS };
      return {};
    }

    // Build activityId → count maps
    const clickMap = new Map<string, number>();
    for (const r of clicks) {
      if (r.activityId) clickMap.set(r.activityId, r._count.activityId);
    }
    const viewMap = new Map<string, number>();
    for (const r of views) {
      if (r.activityId) viewMap.set(r.activityId, r._count.activityId);
    }

    // Fetch sourceUrl for all relevant activity IDs (1 query)
    const allIds = [...new Set([...clickMap.keys(), ...viewMap.keys()])];
    const activities = await prisma.activity.findMany({
      where: { id: { in: allIds } },
      select: { id: true, sourceUrl: true },
    });

    // Agregar clicks y views por dominio
    const domainClicks: Record<string, number> = {};
    const domainViews: Record<string, number> = {};
    for (const act of activities) {
      const domain = getDomainFromUrl(act.sourceUrl);
      if (!domain) continue;
      domainClicks[domain] = (domainClicks[domain] ?? 0) + (clickMap.get(act.id) ?? 0);
      domainViews[domain] = (domainViews[domain] ?? 0) + (viewMap.get(act.id) ?? 0);
    }

    // CTR = clicks / views (redondeado a 3 decimales)
    const result: Record<string, number> = {};
    for (const domain of Object.keys(domainViews)) {
      const v = domainViews[domain];
      if (v > 0) {
        result[domain] = Math.round(((domainClicks[domain] ?? 0) / v) * 1000) / 1000;
      }
    }

    ctrCache = { data: result, expiresAt: now + CTR_CACHE_TTL_MS };
    return result;
  } catch (err: unknown) {
    log.error('Error computing CTR by domain', { error: getErrorMessage(err) });
    return {};
  }
}

// Alias semántico (el cache ya está integrado en la función)
export const getCachedCTR = getCTRByDomain;

/**
 * Convierte un CTR en un boost de ranking.
 * Escala conservadora: máx +0.15 (no desplaza, suma señal real).
 */
export function ctrToBoost(ctr: number): number {
  if (ctr > 0.3) return 0.15;
  if (ctr > 0.15) return 0.08;
  if (ctr > 0.05) return 0.03;
  return 0;
}

/** Clears the CTR cache — only for tests */
export function clearCTRCacheForTests(): void {
  ctrCache = null;
}

/** Valores neutros usados cuando no hay historial de runs. */
const STATS_DEFAULTS = { saveRate: 0.20, avgCost: 50 };

/**
 * Obtiene métricas promedio de los últimos N runs de una fuente.
 *
 * Estrategia:
 *   1. Resuelve el dominio → ScrapingSource.id (UUID) via la tabla ScrapingSource.
 *   2. Consulta source_run_metrics por ese UUID, ordenando por run_at DESC.
 *   3. Computa:
 *      - saveRate  = activities_saved / urls_scraped  (0.20 si no hay datos)
 *      - avgCost   = promedio de llamadas Gemini por run (análogo al presupuesto
 *                    que usa el Scheduler: maxUrls × 1.5 para DEEP=40 → 60 aprox.)
 *
 * Fail-safe: devuelve STATS_DEFAULTS ante cualquier error o ausencia de datos.
 *
 * @param sourceId  Dominio de la fuente (p. ej. 'idartes.gov.co')
 * @param limit     Número de runs a promediar (default 5)
 */
export async function getSourceAggregatedStats(
  sourceId: string,
  limit: number = 5,
): Promise<{ saveRate: number; avgCost: number }> {
  try {
    // ── 1. Resolver dominio → UUID de ScrapingSource ──────────────────────
    const source = await prisma.scrapingSource.findFirst({
      where: { url: { contains: sourceId } },
      select: { id: true },
    });

    if (!source) return STATS_DEFAULTS;

    // ── 2. Consultar últimos N runs (raw — tabla sin modelo Prisma) ───────
    type MetricRow = {
      activities_saved: number;
      urls_scraped:     number;
      gemini_ok:        number;
    };

    const rows = await prisma.$queryRaw<MetricRow[]>`
      SELECT activities_saved, urls_scraped, gemini_ok
      FROM source_run_metrics
      WHERE source_id = ${source.id}
      ORDER BY run_at DESC
      LIMIT ${limit}
    `;

    if (rows.length === 0) return STATS_DEFAULTS;

    // ── 3. Promediar métricas ────────────────────────────────────────────
    const totalSaved   = rows.reduce((s, r) => s + Number(r.activities_saved), 0);
    const totalScraped = rows.reduce((s, r) => s + Number(r.urls_scraped), 0);
    const avgGemini    = rows.reduce((s, r) => s + Number(r.gemini_ok), 0) / rows.length;

    return {
      saveRate: totalScraped > 0
        ? Math.round((totalSaved / totalScraped) * 1000) / 1000
        : STATS_DEFAULTS.saveRate,
      avgCost: Math.round(avgGemini * 10) / 10,
    };
  } catch (err: unknown) {
    log.warn('[metrics] getSourceAggregatedStats falló, usando defaults', {
      sourceId,
      error: getErrorMessage(err),
    });
    return STATS_DEFAULTS;
  }
}
