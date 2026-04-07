// =============================================================================
// /actividades — Página principal de actividades
// Server Component: lee searchParams, consulta DB, renderiza grid + filtros
// =============================================================================

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { listActivities, VALID_SORT_VALUES, type SortValue } from '@/modules/activities';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { Prisma } from '@/generated/prisma/client';
import ActivityCard from './_components/ActivityCard';
import Filters from './_components/Filters';
import Pagination from './_components/Pagination';
import { EmptyState } from './_components/EmptyState';
import { MapView } from './_components/MapView';
import { ViewToggle } from './_components/ViewToggle';

export const metadata: Metadata = {
  title: 'Actividades para niños en Colombia',
  description:
    'Explora talleres, clubes, cursos, campamentos y eventos para niños y familias en Colombia. Filtra por edad, categoría y más.',
  openGraph: {
    title: 'Actividades para niños en Colombia | HabitaPlan',
    description:
      'Explora talleres, clubes, cursos, campamentos y eventos para niños y familias en Colombia.',
  },
  alternates: {
    canonical: '/actividades',
  },
};

const PAGE_SIZE = 24;

interface SearchParams {
  search?: string;
  ageMin?: string;
  ageMax?: string;
  categoryId?: string;
  cityId?: string;
  type?: string;
  audience?: string;
  price?: string;
  sort?: string;
  view?: string;
  page?: string;
}

interface ActiveFilters {
  search?: string;
  ageMin?: number;
  ageMax?: number;
  categoryId?: string;
  cityId?: string;
  type?: string;
  audience?: string;
  price?: string; // 'free' | 'paid' | ''
}

// =============================================================================
// Construye el WHERE de Prisma a partir de los filtros activos
// Se usa tanto en listActivities como en getFacets para consistencia
// =============================================================================
function buildWhere(f: ActiveFilters, exclude?: keyof ActiveFilters): Prisma.ActivityWhereInput {
  const where: Prisma.ActivityWhereInput = { status: 'ACTIVE' };
  const andConditions: Prisma.ActivityWhereInput[] = [];

  if (f.type && exclude !== 'type') {
    where.type = f.type as Prisma.EnumActivityTypeFilter;
  }

  if (f.categoryId && exclude !== 'categoryId') {
    where.categories = { some: { categoryId: f.categoryId } };
  }

  if (f.cityId && exclude !== 'cityId') {
    where.location = { cityId: f.cityId };
  }

  if (f.audience && exclude !== 'audience') {
    const vals =
      f.audience === 'KIDS' ? ['KIDS', 'ALL'] :
      f.audience === 'FAMILY' ? ['FAMILY', 'ALL'] :
      f.audience === 'ADULTS' ? ['ADULTS', 'ALL'] : [];
    if (vals.length) where.audience = { in: vals as Prisma.EnumActivityAudienceFilter['in'] };
  }

  if (f.ageMin !== undefined && exclude !== 'ageMin') {
    andConditions.push({ OR: [{ ageMax: { gte: f.ageMin } }, { ageMax: null }] });
  }
  if (f.ageMax !== undefined && exclude !== 'ageMax') {
    andConditions.push({ OR: [{ ageMin: { lte: f.ageMax } }, { ageMin: null }] });
  }

  if (f.search && exclude !== 'search') {
    andConditions.push({
      OR: [
        { title: { contains: f.search, mode: 'insensitive' } },
        { description: { contains: f.search, mode: 'insensitive' } },
      ],
    });
  }

  if (f.price && exclude !== 'price') {
    if (f.price === 'free') {
      andConditions.push({ OR: [{ price: 0 }, { pricePeriod: 'FREE' }] });
    } else if (f.price === 'paid') {
      andConditions.push({
        AND: [
          { price: { not: null } },
          { price: { gt: 0 } },
          { NOT: { pricePeriod: 'FREE' } },
        ],
      });
    }
  }

  if (andConditions.length) where.AND = andConditions;
  return where;
}

// =============================================================================
// Facets: calcula opciones disponibles por dimensión excluiéndose a sí misma
// Para cada filtro, usa todos los demás filtros activos → 0 combinaciones vacías
// =============================================================================
async function getFacets(filters: ActiveFilters) {
  const [typeGroups, audienceKids, audienceFamily, audienceAdults, validCategories, freeCount, paidCount, availableCities] =
    await Promise.all([
      // Tipos disponibles: con todos los filtros EXCEPTO type
      prisma.activity.groupBy({
        by: ['type'],
        where: buildWhere(filters, 'type'),
        _count: { _all: true },
      }),

      // Audiencias: contamos por separado porque ALL debe sumar en todas
      prisma.activity.count({
        where: { ...buildWhere(filters, 'audience'), audience: { in: ['KIDS', 'ALL'] } },
      }),
      prisma.activity.count({
        where: { ...buildWhere(filters, 'audience'), audience: { in: ['FAMILY', 'ALL'] } },
      }),
      prisma.activity.count({
        where: { ...buildWhere(filters, 'audience'), audience: { in: ['ADULTS', 'ALL'] } },
      }),

      // Categorías disponibles: con todos los filtros EXCEPTO categoryId
      prisma.category.findMany({
        where: { activities: { some: { activity: buildWhere(filters, 'categoryId') } } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, _count: { select: { activities: true } } },
      }),

      // Precio: gratis (price=0 o pricePeriod=FREE)
      prisma.activity.count({
        where: { ...buildWhere(filters, 'price'), OR: [{ price: 0 }, { pricePeriod: 'FREE' }] },
      }),

      // Precio: de pago (price>0 y pricePeriod!=FREE)
      prisma.activity.count({
        where: {
          ...buildWhere(filters, 'price'),
          AND: [
            { price: { not: null } },
            { price: { gt: 0 } },
            { NOT: { pricePeriod: 'FREE' } },
          ],
        },
      }),

      // Ciudades con actividades (excluyendo filtro de ciudad para mostrar todas las opciones)
      prisma.city.findMany({
        where: {
          locations: {
            some: {
              activities: {
                some: buildWhere(filters, 'cityId'),
              },
            },
          },
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

  return {
    availableTypes: typeGroups.map((g) => ({ type: g.type as string, count: g._count._all })),
    audienceCounts: { KIDS: audienceKids, FAMILY: audienceFamily, ADULTS: audienceAdults },
    validCategories,
    priceCounts: { free: freeCount, paid: paidCount },
    availableCities,
  };
}

// =============================================================================
// Page
// =============================================================================
export default async function ActividadesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const parseAge = (v?: string): number | undefined => {
    const n = parseInt(v ?? '', 10);
    return Number.isFinite(n) ? n : undefined;
  };

  const VALID_TYPES = ['ONE_TIME', 'RECURRING', 'WORKSHOP', 'CAMP'];
  const VALID_AUDIENCES = ['KIDS', 'FAMILY', 'ADULTS', 'ALL'];
  const VALID_PRICES = ['free', 'paid'];

  const sortBy = (params.sort && (VALID_SORT_VALUES as readonly string[]).includes(params.sort)
    ? params.sort
    : 'relevance') as SortValue;

  const view = params.view === 'map' ? 'map' : 'list';

  const filters: ActiveFilters = {
    search: params.search?.trim() || undefined,
    ageMin: parseAge(params.ageMin),
    ageMax: parseAge(params.ageMax),
    categoryId: params.categoryId || undefined,
    cityId: params.cityId || undefined,
    type: params.type && VALID_TYPES.includes(params.type) ? params.type : undefined,
    audience: params.audience && VALID_AUDIENCES.includes(params.audience) ? params.audience : undefined,
    price: params.price && VALID_PRICES.includes(params.price) ? params.price : undefined,
  };

  // Cargar actividades, facets, sesión y categorías populares en paralelo
  let favoriteIds = new Set<string>();

  const [{ activities, total }, facets, sessionUser, topCategories] = await Promise.all([
    listActivities({
      skip,
      pageSize: PAGE_SIZE,
      ...filters,
      sortBy,
    }),
    getFacets(filters),
    getSession(),
    // Top 6 categorías globales (para empty state)
    prisma.category.groupBy({
      by: ['id', 'name'],
      where: { activities: { some: { activity: { status: { in: ['ACTIVE', 'EXPIRED'] } } } } },
      orderBy: { _count: { id: 'desc' } },
      take: 6,
    }),
  ]);

  // Si hay sesión, obtener los favoriteIds del usuario (query adicional pero inevitable)
  if (sessionUser) {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: sessionUser.id },
      select: { id: true },
    });
    if (dbUser) {
      const favs = await prisma.favorite.findMany({
        where: { userId: dbUser.id },
        select: { activityId: true },
      });
      favoriteIds = new Set(favs.map((f) => f.activityId));
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 flex flex-col gap-6">

        {/* Título */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Actividades para niños</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Talleres, clubes, cursos y eventos
          </p>
        </div>

        {/* Filtros */}
        <Suspense fallback={<div className="h-12 animate-pulse bg-gray-200 rounded-xl" />}>
          <Filters
            search={params.search ?? ''}
            ageMin={params.ageMin ?? ''}
            ageMax={params.ageMax ?? ''}
            categoryId={params.categoryId ?? ''}
            cityId={params.cityId ?? ''}
            type={params.type ?? ''}
            audience={params.audience ?? ''}
            price={params.price ?? ''}
            sort={sortBy}
            facets={facets}
            total={total}
          />
        </Suspense>

        {/* Toggle Lista / Mapa */}
        <div className="flex items-center justify-end">
          <Suspense>
            <ViewToggle view={view} />
          </Suspense>
        </div>

        {/* Vista Mapa */}
        {view === 'map' && (
          <MapView
            search={params.search ?? ''}
            ageMin={params.ageMin ?? ''}
            ageMax={params.ageMax ?? ''}
            categoryId={params.categoryId ?? ''}
            cityId={params.cityId ?? ''}
            type={params.type ?? ''}
            audience={params.audience ?? ''}
            price={params.price ?? ''}
          />
        )}

        {/* Vista Lista */}
        {view === 'list' && (
          <>
            {activities.length === 0 ? (
              <EmptyState
                search={filters.search}
                ageMin={filters.ageMin}
                ageMax={filters.ageMax}
                categoryId={filters.categoryId}
                categoryName={
                  filters.categoryId
                    ? facets.validCategories.find((c) => c.id === filters.categoryId)?.name
                    : undefined
                }
                type={filters.type}
                audience={filters.audience}
                popularCategories={topCategories}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {activities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    isFavorited={favoriteIds.has(activity.id)}
                  />
                ))}
              </div>
            )}

            {/* Paginación */}
            <Suspense>
              <Pagination page={page} totalPages={totalPages} />
            </Suspense>

            {activities.length > 0 && (
              <p className="text-center text-xs text-gray-400 pb-4">
                Mostrando {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} de {total} actividades
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
