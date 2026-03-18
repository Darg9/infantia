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
  status?: string;
  type?: string;
  search?: string;
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

  // Age overlap: activity range overlaps with requested range
  if (params.ageMin !== undefined) {
    where.OR = [
      ...(where.OR ?? []),
      { ageMax: { gte: params.ageMin } },
      { ageMax: null },
    ];
  }
  if (params.ageMax !== undefined) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { OR: [{ ageMin: { lte: params.ageMax } }, { ageMin: null }] },
    ];
  }

  if (params.priceMin !== undefined || params.priceMax !== undefined) {
    where.price = {};
    if (params.priceMin !== undefined) where.price.gte = params.priceMin;
    if (params.priceMax !== undefined) where.price.lte = params.priceMax;
  }

  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      include: activityIncludes,
      orderBy: { createdAt: 'desc' },
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
