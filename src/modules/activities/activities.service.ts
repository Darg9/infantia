// =============================================================================
// Activities - Business Logic Service
// =============================================================================

import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import type { CreateActivityInput, UpdateActivityInput } from './activities.schemas';
import { getDomainFromUrl, computeActivityScore } from './ranking';
import { getCachedCTR, ctrToBoost } from '@/modules/analytics/metrics';

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

  if (params.search) {
    // pg_trgm: búsqueda fuzzy con tolerancia a errores tipográficos
    // Combina ILIKE (coincidencia exacta de substring) + similarity (fuzzy)
    const searchPattern = `%${params.search}%`;
    const searchResults = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM activities
      WHERE
        title ILIKE ${searchPattern}
        OR description ILIKE ${searchPattern}
        OR similarity(title, ${params.search}) > 0.2
      LIMIT 500
    `;
    const matchingIds = searchResults.map((r) => r.id);
    if (matchingIds.length === 0) {
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
    if (h.score < 0.3) {
      badDomains.push(h.source);
    }
  }

  // 2. Filtrado mínimo pre-SQL para aliviar presión y asegurar páginas completas
  const isRelevanceSort = !params.sortBy || params.sortBy === 'relevance';
  
  if (isRelevanceSort && badDomains.length > 0) {
    andConditions.push({
      NOT: { sourceDomain: { in: badDomains } }
    });
  }

  if (andConditions.length) {
    where.AND = andConditions;
  }

  const orderBy: Prisma.ActivityOrderByWithRelationInput[] = buildOrderBy(params.sortBy);

  // 3. Estrategia híbrida: Sql Over-fetch 
  // Multiplicamos por 3 el buffer y aseguramos que no se exceda el MAX_FETCH (200) para protección de Vercel.
  const MAX_FETCH = 200;
  
  // Start from skip 0 to capture all elements on the left, up to requested UI chunk.
  const takeAmount = isRelevanceSort 
      ? Math.min(params.skip + (params.pageSize * 3), MAX_FETCH) 
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
    // Si viene legacy activity, usa el helper as fallback
    const domain = act.sourceDomain || getDomainFromUrl(act.sourceUrl);
    const healthScore = healthDict[domain] ?? 0.5; // Neutral fallback asegurado
    const ctr = ctrMap[domain] ?? 0;
    const ctrBoost = ctrToBoost(ctr);
    const rankingScore = computeActivityScore(act, healthScore, ctrBoost);
    return { ...act, rankingScore, _domainTemp: domain };
  });

  // 5. Ordenamiento final e Invisibilidad (Safety net redundante)
  let totalHidden = 0;
  let diversified: any[] = processedActivities; // fallback para sort no-relevance
  
  if (isRelevanceSort) {
    const initialCount = processedActivities.length;
    
    // Ocultar cutoff de ruido, pero mitigando el Incomplete Page
    let filteredActivities = processedActivities.filter(a => a.rankingScore >= 0.3);
    
    // EDGE CASE: Fallback (relajar filtro temporalmente para no dejar huecos de layout UI vacios)
    if (filteredActivities.length < params.pageSize) {
      filteredActivities = processedActivities.filter(a => a.rankingScore >= 0.2);
    }
    
    processedActivities = filteredActivities;
    totalHidden = initialCount - processedActivities.length;

    processedActivities.sort((a, b) => b.rankingScore - a.rankingScore);

    // Evitar dominancia usando Map (Max 5 items per source globales)
    const MAX_ITEMS_PER_SOURCE = 5;
    const grouped = new Map<string, number>();
    diversified = [];

    for (const item of processedActivities) {
      const d = item._domainTemp || 'unknown';
      const count = grouped.get(d) || 0;

      if (count < MAX_ITEMS_PER_SOURCE) {
        diversified.push(item);
        grouped.set(d, count + 1);
      }
    }
  }

  // 6. Paginación final Slice 
  const pagedActivities = isRelevanceSort
    ? diversified.slice(params.skip, params.skip + params.pageSize).map(({ _domainTemp, ...rest }) => rest)
    : diversified.map(({ _domainTemp, ...rest }) => rest);

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

  return { activities: pagedActivities, total: finalTotal };
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
