// =============================================================================
// Activities - Business Logic Service
// =============================================================================

import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import type { CreateActivityInput, UpdateActivityInput } from './activities.schemas';

const activityIncludes = {
  provider: { select: { id: true, name: true, type: true, logoUrl: true, isVerified: true } },
  location: {
    select: {
      id: true, name: true, address: true, neighborhood: true,
      city: { select: { id: true, name: true } },
    },
  },
  vertical: { select: { id: true, slug: true, name: true } },
  categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.ActivityInclude;

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
}

// Valores de audience que aplican a cada opción de filtro
function audienceValues(audience: string): string[] {
  if (audience === 'KIDS') return ['KIDS', 'ALL'];
  if (audience === 'FAMILY') return ['FAMILY', 'ALL'];
  if (audience === 'ADULTS') return ['ADULTS', 'ALL'];
  return [];
}

export async function listActivities(params: ListParams) {
  const where: Prisma.ActivityWhereInput = {};

  if (params.status) {
    where.status = params.status as Prisma.EnumActivityStatusFilter;
  } else {
    // Mostrar ACTIVE y EXPIRED (con badge). Ocultar DRAFT y PAUSED (estados internos).
    where.status = { in: ['ACTIVE', 'EXPIRED'] };
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

  if (andConditions.length) {
    where.AND = andConditions;
  }

  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      include: activityIncludes,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: params.skip,
      take: params.pageSize,
    }),
    prisma.activity.count({ where }),
  ]);

  return { activities, total };
}

export async function getActivityById(id: string) {
  return prisma.activity.findUnique({
    where: { id },
    include: {
      ...activityIncludes,
      _count: { select: { favorites: true, ratings: true } },
    },
  });
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

  return prisma.activity.create({
    data: {
      ...activityData,
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

  return prisma.activity.update({
    where: { id },
    data: {
      ...updateData,
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
