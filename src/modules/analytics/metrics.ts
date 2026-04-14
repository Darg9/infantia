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
  } catch (err: any) {
    log.error('Error computing CTR by domain', { error: err.message });
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
