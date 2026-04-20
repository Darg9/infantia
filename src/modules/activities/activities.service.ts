// =============================================================================
// Activities - Business Logic Service
// =============================================================================

import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import type { CreateActivityInput, UpdateActivityInput } from './activities.schemas';
import { getDomainFromUrl, computeActivityScore } from './ranking';
import { getCachedCTR, ctrToBoost } from '@/modules/analytics/metrics';
import { normalizeSearchQuery } from '@/lib/search';
import { createLogger } from '@/lib/logger';

const log = createLogger('activities:search');

const activityIncludes = {
  provider: { select: { id: true, name: true, slug: true, type: true, logoUrl: true, isVerified: true, isPremium: true } },
  location: {
    select: {
      id: true, name: true, address: true, neighborhood: true,
      latitude: true, longitude: true,
      city: { select: { id: true, name: true } },
    },
  },
  vertical: { select: { id: true, slug: true, name: true } },
  categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
  _count: { select: { views: true } }
} satisfies Prisma.ActivityInclude;

// =========================================================================
// TTL Caches para mitigar DB Pressure en Vercel Serverless
// =========================================================================
let cachedHealthData: { source: string; score: number }[] | null = null;
let healthCacheExpiresAt = 0;
const HEALTH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

async function getCachedHealthData() {
  if (!cachedHealthData || Date.now() > healthCacheExpiresAt) {
    cachedHealthData = await prisma.sourceHealth.findMany({ select: { source: true, score: true } });
    healthCacheExpiresAt = Date.now() + HEALTH_CACHE_TTL_MS;
  }
  return cachedHealthData;
}

const countCache = new Map<string, { value: number, expiresAt: number }>();
const COUNT_CACHE_TTL_MS = 60 * 1000; // 60 segundos

export async function getCachedCount(where: any): Promise<number> {
  const key = JSON.stringify(where);
  const now = Date.now();
  const cached = countCache.get(key);

  const isHit = Boolean(cached && cached.expiresAt > now);
  
  if (isHit) {
    console.info(JSON.stringify({ event: "count_cache", hit: true, keyLength: key.length, timestamp: new Date().toISOString() }));
    return cached!.value;
  }

  const count = await prisma.activity.count({ where });

  countCache.set(key, {
    value: count,
    expiresAt: now + COUNT_CACHE_TTL_MS
  });
  
  console.info(JSON.stringify({ event: "count_cache", hit: false, keyLength: key.length, timestamp: new Date().toISOString() }));

  return count;
}

export function clearCountCacheForTests() {
  countCache.clear();
}

export const VALID_SORT_VALUES = ['relevance', 'date', 'price_asc', 'price_desc', 'newest'] as const;
export type SortValue = (typeof VALID_SORT_VALUES)[number];

interface ListParams {
  skip: number;
  pageSize: number;
  verticalId?: string;
  categoryId?: string;
  cityId?: string;
  ageMin?: number;
  ageMax?: number;
  priceMin?: number;
  priceMax?: number;
  /** 'free' | 'paid' | undefined */
  price?: string;
  status?: string;
  type?: string;
  audience?: string;
  search?: string;
  /** 'relevance' | 'date' | 'price_asc' | 'price_desc' | 'newest' */
  sortBy?: SortValue;
}

// Valores de audience que aplican a cada opción de filtro
function audienceValues(audience: string): string[] {
  if (audience === 'KIDS') return ['KIDS', 'ALL'];
  if (audience === 'FAMILY') return ['FAMILY', 'ALL'];
  if (audience === 'ADULTS') return ['ADULTS', 'ALL'];
  return [];
}

function buildOrderBy(sortBy?: SortValue): Prisma.ActivityOrderByWithRelationInput[] {
  switch (sortBy) {
    case 'date':
      // Próximas primero; actividades sin fecha al final
      return [{ startDate: { sort: 'asc', nulls: 'last' } }, { status: 'asc' }];
    case 'price_asc':
      // Más económico primero; sin precio al final
      return [{ price: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }];
    case 'price_desc':
      // Más caro primero; sin precio al final
      return [{ price: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }];
    case 'newest':
      // Recién agregadas a HabitaPlan
      return [{ createdAt: 'desc' }];
    case 'relevance':
    default:
      // Activas primero, premium dentro de activas, luego por confianza del scraper
      return [{ status: 'asc' }, { provider: { isPremium: 'desc' } }, { sourceConfidence: 'desc' }, { createdAt: 'desc' }];
  }
}

export async function listActivities(params: ListParams) {
  // SAFETY NET: Feature Flag global para apagar el ranking y forzar cronológico transversalmente
  const isForced = process.env.FORCE_CHRONO === 'true';
  const effectiveSort = isForced ? 'newest' : params.sortBy;

  const where: Prisma.ActivityWhereInput = {};

  if (params.status) {
    where.status = params.status as Prisma.EnumActivityStatusFilter;
  } else {
    // Mostrar solo ACTIVE. Las EXPIRED se ocultan automáticamente del portal.
    where.status = 'ACTIVE';
  }

  if (params.verticalId) where.verticalId = params.verticalId;
  if (params.type) where.type = params.type as Prisma.EnumActivityTypeFilter;
  if (params.categoryId) where.categories = { some: { categoryId: params.categoryId } };
  if (params.cityId) where.location = { cityId: params.cityId };

  // Audience — actividades con audience=ALL aparecen en todos los filtros
  if (params.audience) {
    const vals = audienceValues(params.audience);
    if (vals.length) where.audience = { in: vals as Prisma.EnumActivityAudienceFilter['in'] };
  }

  // Acumulamos condiciones AND para evitar conflictos entre age y search
  const andConditions: Prisma.ActivityWhereInput[] = [];

  // Age overlap: activity range overlaps with requested range
  if (params.ageMin !== undefined) {
    andConditions.push({ OR: [{ ageMax: { gte: params.ageMin } }, { ageMax: null }] });
  }
  if (params.ageMax !== undefined) {
    andConditions.push({ OR: [{ ageMin: { lte: params.ageMax } }, { ageMin: null }] });
  }

  if (params.priceMin !== undefined || params.priceMax !== undefined) {
    where.price = {};
    if (params.priceMin !== undefined) where.price.gte = params.priceMin;
    if (params.priceMax !== undefined) where.price.lte = params.priceMax;
  }

  if (params.price === 'free') {
    andConditions.push({ OR: [{ price: 0 }, { pricePeriod: 'FREE' }] });
  } else if (params.price === 'paid') {
    andConditions.push({
      AND: [
        { price: { not: null } },
        { price: { gt: 0 } },
        { NOT: { pricePeriod: 'FREE' } },
      ],
    });
  }

  let textScoreMap: Map<string, number> | null = null;

  if (params.search) {
    const rawSearch = params.search;
    const cleanSearch = normalizeSearchQuery(rawSearch);
    const q = cleanSearch.length > 0 ? cleanSearch : rawSearch;

    const patternExact  = `%${q}%`;
    const patternPrefix = `${q}%`;

    // ── pg_trgm: similarity en título + word_similarity para frases largas  ──
    // Umbrales calibrados:
    //   title similarity  > 0.25  (evita ruido, title es señal fuerte)
    //   word_similarity   > 0.30  (funciona mejor para queries cortos en frases largas)
    //   description sim.  > 0.15  (más permisivo — texto largo diluye similaridad)
    //   ILIKE fallback   siempre  (garantiza resultados exactos aunque sim sea baja)
    const searchResults = await prisma.$queryRaw<{
      id: string;
      sim_title: number;
      sim_desc: number;
      exact_title: boolean;
      prefix_title: boolean;
    }[]>`
      SELECT
        id,
        similarity(title, ${q})                  AS sim_title,
        similarity(left(description, 500), ${q}) AS sim_desc,
        (title ILIKE ${patternExact})             AS exact_title,
        (title ILIKE ${patternPrefix})            AS prefix_title
      FROM activities
      WHERE
        similarity(title, ${q}) > 0.25
        OR word_similarity(${q}, title) > 0.30
        OR title ILIKE ${patternExact}
        OR similarity(left(description, 500), ${q}) > 0.15
      ORDER BY
        similarity(title, ${q}) * 0.7 +
        similarity(left(description, 500), ${q}) * 0.3 +
        CASE WHEN title ILIKE ${patternPrefix} THEN 0.10 ELSE 0 END
      DESC
      LIMIT 60
    `;

    log.info('Intento de búsqueda de actividades', { action: 'activity_search', result: 'attempt', queryLength: rawSearch.length, raw: rawSearch, normalized: q });

    const matchingIds: string[] = [];
    textScoreMap = new Map();

    for (const r of searchResults) {
      matchingIds.push(r.id);

      // Scoring JS: combinación ponderada 70/30 + boosts por exact/prefix
      const simTitle = Number(r.sim_title || 0);
      const simDesc  = Number(r.sim_desc  || 0);
      let textScore  = simTitle * 0.7 + simDesc * 0.3;
      if (r.exact_title)  textScore += 5;
      if (r.prefix_title) textScore += 0.10;
      if (r.prefix_title) textScore += 2;

      textScoreMap.set(r.id, textScore);
    }

    if (matchingIds.length === 0) {
      log.info('Búsqueda sin resultados', { action: 'activity_search', result: 'success', results: 0 });
      return { activities: [], total: 0 };
    }
    andConditions.push({ id: { in: matchingIds } });
  }

  // 1. Obtener Diccionario Global de Orígenes para ranking (Con caché TTL de 5 minutos)
  const [healthData, ctrMap] = await Promise.all([
    getCachedHealthData(),
    getCachedCTR(),
  ]);
  const healthDict: Record<string, number> = {};
  const badDomains: string[] = [];
  
  for (const h of healthData) {
    healthDict[h.source] = h.score;
    // Threshold conservador: solo ocultar fuentes con score < 0.1 (prácticamente muertas).
    // Entre 0.1–0.3 el ranking score bajo ya las empuja al fondo sin ocultarlas.
    if (h.score < 0.1) {
      badDomains.push(h.source);
    }
  }

  // 2. Filtrado mínimo pre-SQL para aliviar presión y asegurar páginas completas
  const isRelevanceSort = !effectiveSort || effectiveSort === 'relevance';
  
  if (isRelevanceSort && badDomains.length > 0) {
    // IMPORTANTE: NOT IN en SQL excluye NULLs (NULL NOT IN (...) → NULL, no TRUE).
    // Las actividades sin sourceDomain (pre-fix) son legítimas y deben mostrarse.
    // Usamos OR explícito para preservar las que aún no tienen dominio asignado.
    andConditions.push({
      OR: [
        { sourceDomain: null },
        { NOT: { sourceDomain: { in: badDomains } } },
      ],
    });
  }

  if (andConditions.length) {
    where.AND = andConditions;
  }

  const orderBy: Prisma.ActivityOrderByWithRelationInput[] = buildOrderBy(effectiveSort);

  // 3. Estrategia híbrida: Sql Over-fetch
  // Para relevance, traemos desde skip=0 cubriendo al menos la página pedida + buffer
  // para que el filtro de score no deje el slice vacío. MAX_FETCH=500 protege Vercel.
  const MAX_FETCH = 500;

  // Buffer = 3× pageSize para absorber actividades filtradas por ranking score.
  const takeAmount = isRelevanceSort
    ? Math.min(params.skip + params.pageSize * 3, MAX_FETCH)
    : params.pageSize;

  const skipAmount = isRelevanceSort ? 0 : params.skip;

  let rawActivities: any[] = [];
  let finalTotal: number = 0;

  // Ejecución asíncrona paralela: Obtener el pull y su metadata de conteo nativo con TTL Cacheado
  [rawActivities, finalTotal] = await Promise.all([
    prisma.activity.findMany({
      where,
      include: activityIncludes,
      orderBy,
      skip: skipAmount,
      take: takeAmount,
    }),
    getCachedCount(where)
  ]);

  console.info(JSON.stringify({
    event: "count_query_executed",
    total: finalTotal,
    timestamp: new Date().toISOString()
  }));

  // 4. Evaluar y rankear en Memoria
  let processedActivities = rawActivities.map(act => {
    const domain = act.sourceDomain || getDomainFromUrl(act.sourceUrl);
    const healthScore = healthDict[domain] ?? 0.5;
    const ctr = ctrMap[domain] ?? 0;
    const ctrBoost = ctrToBoost(ctr);

    let rankingScore = computeActivityScore(act, healthScore, ctrBoost);
    
    // Si viene de una busqueda con score textual, aplicamos la nueva formula hibrida
    if (textScoreMap && textScoreMap.has(act.id)) {
      const textScore = textScoreMap.get(act.id)!;
      rankingScore = (textScore * 0.5) + (healthScore * 0.3) + (ctrBoost * 0.2);
    }

    // Penalización por metadatos incompletos (Pipeline Requirement)
    if (act.ageMin === null && act.ageMax === null) {
      rankingScore *= 0.85;
    }

    return { ...act, rankingScore, _domainTemp: domain };
  });

  // 5. Ordenamiento final y diversificación POR PÁGINA
  // IMPORTANTE: la diversificación se aplica DESPUÉS del slice de página para que
  // nunca bloquee la paginación (si se aplica globalmente, con pocas fuentes/dominios
  // los primeros N items consumen toda la cuota y las páginas 2+ quedan vacías).
  let totalHidden = 0;
  let diversified: any[] = processedActivities; // fallback para sort no-relevance

  if (isRelevanceSort) {
    const initialCount = processedActivities.length;
    // needed = cuántos items necesitamos disponibles para llegar al final de esta página
    const needed = params.skip + params.pageSize;

    // Filtro de calidad con fallback progresivo según profundidad de página
    let filteredActivities = processedActivities.filter(a => a.rankingScore >= 0.3);
    if (filteredActivities.length < needed) {
      filteredActivities = processedActivities.filter(a => a.rankingScore >= 0.2);
    }
    if (filteredActivities.length < needed) {
      // Último recurso: mostrar todo antes de dejar la página vacía
      filteredActivities = processedActivities;
    }

    processedActivities = filteredActivities;
    totalHidden = initialCount - processedActivities.length;

    // Ordenar por score descendente y tomar el slice de la página
    processedActivities.sort((a, b) => b.rankingScore - a.rankingScore);
    diversified = processedActivities.slice(params.skip, params.skip + params.pageSize);
  }

  // 6. Resultado final
  // — relevance: `diversified` ya contiene exactamente el slice de la página actual
  // — otros sorts: la paginación la hizo SQL (skipAmount/takeAmount)
  const pagedActivities = diversified.map(({ _domainTemp, ...rest }) => rest);

  // 8. LOGGING OBLIGATORIO
  if (isRelevanceSort) {
      const domainsWithCTR = Object.entries(ctrMap).filter(([, v]) => v > 0).length;
      console.info(JSON.stringify({
        event: "ranking_applied",
        fetched: rawActivities.length,
        afterFilter: processedActivities.length,
        afterDiversity: diversified.length,
        returned: pagedActivities.length,
        ctrDomainsActive: domainsWithCTR,
        timestamp: new Date().toISOString()
      }));
  }

  if (params.search) {
    log.info('Búsqueda de actividades completada', { action: 'activity_search', result: 'success', results: finalTotal });
  }

  return { 
    activities: pagedActivities, 
    total: finalTotal,
    meta: {
      sort: effectiveSort,
      forced: isForced
    }
  };
}

export async function getActivityById(id: string) {
  const activity = await prisma.activity.findUnique({
    where: { id },
    include: {
      ...activityIncludes,
      _count: { select: { favorites: true, ratings: true } },
    },
  });

  if (!activity) return null;

  const domain = getDomainFromUrl(activity.sourceUrl);
  const healthData = await prisma.sourceHealth.findUnique({ where: { source: domain } });
  const rankingScore = computeActivityScore(activity, healthData?.score);

  return { ...activity, rankingScore };
}

/**
 * Devuelve hasta `limit` actividades similares a la dada.
 * Criterio: comparten al menos una categoría, misma ciudad preferida.
 * Excluye la actividad actual y las EXPIRED/DRAFT.
 */
export async function getSimilarActivities(activityId: string, limit = 4) {
  // 1. Obtener categorías y ciudad de la actividad base
  const base = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      categories: { select: { categoryId: true } },
      location: { select: { cityId: true } },
    },
  });

  if (!base) return [];

  const categoryIds = base.categories.map((c) => c.categoryId);
  const cityId = base.location?.cityId;

  if (categoryIds.length === 0) return [];

  // 2. Buscar por categorías compartidas (misma ciudad tiene prioridad vía orderBy score)
  const candidates = await prisma.activity.findMany({
    where: {
      id: { not: activityId },
      status: 'ACTIVE',
      categories: { some: { categoryId: { in: categoryIds } } },
    },
    include: activityIncludes,
    take: limit * 3, // Traer más para poder reordenar
  });

  // 3. Puntuar: +2 por misma ciudad, +1 por cada categoría compartida
  const scored = candidates.map((act) => {
    const sharedCats = act.categories.filter((c) => categoryIds.includes(c.category.id)).length;
    const sameCity = cityId && act.location?.city.id === cityId ? 2 : 0;
    return { act, score: sharedCats + sameCity };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.act);
}

export async function createActivity(data: CreateActivityInput) {
  const { categoryIds, ...activityData } = data;
  let sourceDomain: string | undefined = undefined;

  if (activityData.sourceUrl) {
    sourceDomain = getDomainFromUrl(activityData.sourceUrl);
  }

  return prisma.activity.create({
    data: {
      ...activityData,
      sourceDomain,
      startDate: activityData.startDate ? new Date(activityData.startDate) : undefined,
      endDate: activityData.endDate ? new Date(activityData.endDate) : undefined,
      ...(categoryIds?.length && {
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      }),
    },
    include: activityIncludes,
  });
}

export async function updateActivity(id: string, data: UpdateActivityInput) {
  const { categoryIds, ...updateData } = data;
  let sourceDomain: string | undefined = undefined;

  if (updateData.sourceUrl) {
    sourceDomain = getDomainFromUrl(updateData.sourceUrl);
  }

  return prisma.activity.update({
    where: { id },
    data: {
      ...updateData,
      sourceDomain,
      ...(updateData.startDate && { startDate: new Date(updateData.startDate) }),
      ...(updateData.endDate && { endDate: new Date(updateData.endDate) }),
      ...(categoryIds && {
        categories: {
          deleteMany: {},
          create: categoryIds.map((categoryId) => ({ categoryId })),
        },
      }),
    },
    include: activityIncludes,
  });
}

export async function deleteActivity(id: string) {
  return prisma.activity.update({
    where: { id },
    data: { status: 'EXPIRED' },
  });
}
