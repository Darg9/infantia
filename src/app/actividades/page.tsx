// =============================================================================
// /actividades — Página principal de actividades
// Server Component: lee searchParams, consulta DB, renderiza grid + filtros
// =============================================================================

import { Suspense } from 'react';
import { listActivities } from '@/modules/activities';
import { prisma } from '@/lib/db';
import ActivityCard from './_components/ActivityCard';
import Filters from './_components/Filters';
import Pagination from './_components/Pagination';

const PAGE_SIZE = 24;

interface SearchParams {
  search?: string;
  ageMin?: string;
  ageMax?: string;
  categoryId?: string;
  page?: string;
}

async function getCategories() {
  // Solo categorías que tienen al menos una actividad
  return prisma.category.findMany({
    where: { activities: { some: {} } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

export default async function ActividadesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const [{ activities, total }, categories] = await Promise.all([
    listActivities({
      skip,
      pageSize: PAGE_SIZE,
      search: params.search?.trim() || undefined,
      ageMin: params.ageMin ? parseInt(params.ageMin, 10) : undefined,
      ageMax: params.ageMax ? parseInt(params.ageMax, 10) : undefined,
      categoryId: params.categoryId || undefined,
    }),
    getCategories(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-indigo-700">Infantia</span>
            <span className="hidden sm:inline text-sm text-gray-400">· Actividades para niños</span>
          </div>
          <a
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Inicio
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 flex flex-col gap-6">

        {/* Título de sección */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Actividades para niños</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Talleres, clubes, cursos y eventos en Bogotá
          </p>
        </div>

        {/* Filtros — necesita Suspense porque usa useSearchParams internamente en la paginación */}
        <Suspense fallback={<div className="h-12 animate-pulse bg-gray-200 rounded-xl" />}>
          <Filters
            search={params.search ?? ''}
            ageMin={params.ageMin ?? ''}
            ageMax={params.ageMax ?? ''}
            categoryId={params.categoryId ?? ''}
            categories={categories}
            total={total}
          />
        </Suspense>

        {/* Grid de actividades */}
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <span className="text-5xl">🔍</span>
            <p className="text-gray-600 font-medium">No encontramos actividades con esos filtros</p>
            <p className="text-sm text-gray-400">Intenta cambiar la búsqueda o el rango de edad</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        )}

        {/* Paginación */}
        <Suspense>
          <Pagination page={page} totalPages={totalPages} />
        </Suspense>

        {/* Footer mínimo */}
        {activities.length > 0 && (
          <p className="text-center text-xs text-gray-400 pb-4">
            Mostrando {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} de {total} actividades
          </p>
        )}
      </main>
    </div>
  );
}
