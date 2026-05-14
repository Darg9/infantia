// =============================================================================
// /actividades — Página principal de actividades
// ISR 1h: Vercel cachea en CDN, revalida en background cada hora.
// Server Component: lee searchParams, consulta DB, renderiza grid + filtros
// =============================================================================

export const revalidate = 3600 // 1h — contenido dinámico, se actualiza frecuente

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { listActivities, VALID_SORT_VALUES, type SortValue } from '@/modules/activities';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { Prisma } from '@/generated/prisma/client';
import { buildActivityWhere, type ActivityFilterParams } from '@/modules/activities/activity-filters';
import ActivityCard from './_components/ActivityCard';
import Filters, { FiltersSkeleton } from './_components/Filters';
import Pagination from './_components/Pagination';
import { EmptyState } from './_components/EmptyState';
import { MapView } from './_components/MapView';
import { ViewToggle } from './_components/ViewToggle';
import { ACTIVITY_DISCLAIMER_SHORT } from '@/modules/legal/constants/legal-disclaimers';
import { FEATURE_FLAGS } from '@/config/feature-flags';
import { serializeActivity } from '@/lib/prisma-serialize';
import { roundRobinByCategory } from '@/lib/diversity-utils';

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
  /** Rango de fecha: 'today' | 'weekend' | 'week' (S65, gated por DATE_FILTER_ENABLED) */
  dateRange?: string;
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
  /** Rango de fecha (solo si DATE_FILTER_ENABLED) */
  dateRange?: 'today' | 'weekend' | 'week';
}

// =============================================================================
// buildWhere — wrapper de buildActivityWhere para getFacets
// Mapea ActiveFilters → ActivityFilterParams y delega al SSOT.
// Nota: los facets NO pasan badDomains → muestran todas las opciones disponibles
// sin importar la calidad de la fuente.
// =============================================================================
function buildWhere(f: ActiveFilters, exclude?: keyof ActiveFilters): Prisma.ActivityWhereInput {
  return buildActivityWhere(f as ActivityFilterParams, exclude as keyof ActivityFilterParams | undefined);
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
      // _count filtra por los mismos criterios para que el número coincida con los resultados
      prisma.category.findMany({
        where: { activities: { some: { activity: buildWhere(filters, 'categoryId') } } },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              activities: { where: { activity: buildWhere(filters, 'categoryId') } },
            },
          },
        },
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

      // Ciudades con actividades geo-asignadas reales (mismo criterio que el Header).
      // No usar isActive:true ni OR pattern — ambos incluyen ciudades sin contenido local.
      prisma.city.findMany({
        where: {
          isActive: true,
          locations: {
            some: {
              activities: {
                some: { status: 'ACTIVE' },
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

  const VALID_DATE_RANGES = ['today', 'weekend', 'week'] as const;
  type DateRangeValue = typeof VALID_DATE_RANGES[number];

  const filters: ActiveFilters = {
    search: params.search?.trim() || undefined,
    ageMin: parseAge(params.ageMin),
    ageMax: parseAge(params.ageMax),
    categoryId: params.categoryId || undefined,
    cityId: params.cityId || undefined,
    type: params.type && VALID_TYPES.includes(params.type) ? params.type : undefined,
    audience: params.audience && VALID_AUDIENCES.includes(params.audience) ? params.audience : undefined,
    price: params.price && VALID_PRICES.includes(params.price) ? params.price : undefined,
    // dateRange: solo se acepta si el feature flag está activo
    dateRange: FEATURE_FLAGS.DATE_FILTER_ENABLED && params.dateRange && (VALID_DATE_RANGES as readonly string[]).includes(params.dateRange)
      ? params.dateRange as DateRangeValue
      : undefined,
  };

  // Diversidad page 1: pool extra para round-robin por categoría.
  // Condiciones: solo primera página, sin filtro de categoría ni búsqueda activa.
  // En páginas siguientes o con filtros específicos, el ranking puro es más útil.
  const DIVERSITY_EXTRA = 12; // candidatos adicionales para el round-robin
  const shouldDiversify = skip === 0 && !filters.categoryId && !filters.search;
  const fetchSize = shouldDiversify ? PAGE_SIZE + DIVERSITY_EXTRA : PAGE_SIZE;

  // Cargar actividades, facets, sesión y categorías populares en paralelo
  let favoriteIds = new Set<string>();

  const [{ activities: rawActivities, total }, facets, sessionUser, topCategories, selectedCategory, selectedCity] = await Promise.all([
    listActivities({
      skip,
      pageSize: fetchSize,
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
    // Nombres estables de los filtros seleccionados (no dependen de la lista facetada)
    filters.categoryId
      ? prisma.category.findUnique({ where: { id: filters.categoryId }, select: { name: true } })
      : Promise.resolve(null),
    filters.cityId
      ? prisma.city.findUnique({ where: { id: filters.cityId }, select: { name: true } })
      : Promise.resolve(null),
  ]);

  // Aplicar round-robin solo en page 1 sin filtros de categoría/búsqueda.
  // Respeta el score interno de cada grupo — no es shuffle, es reordenamiento suave.
  const activities = shouldDiversify
    ? roundRobinByCategory(rawActivities, PAGE_SIZE)
    : rawActivities;

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
      favoriteIds = new Set(favs.map((f) => f.activityId).filter((id): id is string => id !== null));
    }
  }

  // Fallback Data UX: si el usuario buscó texto pero no hay matches
  let fallbackActivities: Awaited<ReturnType<typeof listActivities>>['activities'] = [];
  if (total === 0 && filters.search) {
    const { activities } = await listActivities({ skip: 0, pageSize: 4, sortBy: 'relevance' });
    fallbackActivities = activities;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[var(--hp-bg-page)]">

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* CABECERA — fondo blanco, título + buscador + filtros           */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="bg-[var(--hp-bg-surface)] border-b border-[var(--hp-border)]">
        <div className="mx-auto max-w-7xl px-4 pt-8 pb-5">

          {/* Título + subtítulo */}
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-[var(--hp-text-primary)] leading-tight">
              Actividades para niños
            </h1>
            <p className="text-sm text-[var(--hp-text-secondary)] mt-1">
              Encuentra talleres, cursos y eventos según edad, ubicación y presupuesto
            </p>
          </div>

          {/* Buscador + filtros + chips + conteo */}
          <Suspense fallback={<FiltersSkeleton />}>
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
              dateRange={filters.dateRange ?? ''}
              dateFilterEnabled={FEATURE_FLAGS.DATE_FILTER_ENABLED}
              facets={facets}
              total={total}
              selectedCategoryName={selectedCategory?.name}
              selectedCityName={selectedCity?.name}
            />
          </Suspense>
          <p className="text-xs text-[var(--hp-text-muted)] mt-2 pb-1">{ACTIVITY_DISCLAIMER_SHORT}</p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* RESULTADOS — fondo gris, lista o mapa                          */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="mx-auto max-w-7xl px-4 py-6 flex flex-col gap-6">

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
                fallbackActivities={fallbackActivities}
                favoriteIds={favoriteIds}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {activities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={serializeActivity(activity)}
                    isFavorited={favoriteIds.has(activity.id)}
                    searchQuery={filters.search ?? ''}
                  />
                ))}
              </div>
            )}

            {/* Paginación */}
            <Suspense>
              <Pagination page={page} totalPages={totalPages} />
            </Suspense>

            {activities.length > 0 && (
              <p className="text-center text-xs text-[var(--hp-text-muted)] pb-4">
                Mostrando {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} de {total} actividades
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
