// =============================================================================
// Home — Landing page de HabitaPlan
// Server Component: stats reales, categorías destacadas, actividades recientes
// =============================================================================

import type { Metadata } from 'next';
import Link from 'next/link';
import { listActivities } from '@/modules/activities';
import { prisma } from '@/lib/db';
import { getCategoryEmoji, getCategoryGradient } from '@/lib/category-utils';
import ActivityCard from '@/app/actividades/_components/ActivityCard';
import HeroSearch from '@/app/_components/HeroSearch';

export const metadata: Metadata = {
  title: 'HabitaPlan — Actividades para niños y familias en Colombia',
  description:
    'Descubre talleres, clubes, campamentos y eventos para niños y familias en Colombia. Todo en un solo lugar, siempre actualizado.',
};

function logHomeQueryFailure(queryName: string, reason: unknown) {
  const error =
    reason instanceof Error
      ? { message: reason.message, stack: reason.stack }
      : { message: String(reason) };

  console.error(
    JSON.stringify({
      event: 'home_query_failed',
      queryName,
      ...error,
      timestamp: new Date().toISOString(),
    }),
  );
}

export default async function HomePage() {
  // Home resiliente: una query rota no debe tumbar todo el portal.
  const [
    totalActivitiesResult,
    totalCitiesResult,
    totalProvidersResult,
    totalCategoriesResult,
    topCategoriesResult,
    recentActivitiesResult,
    popularActivitiesResult,
  ] = await Promise.allSettled([
    // Total de actividades activas (visible en la plataforma)
    listActivities({ skip: 0, pageSize: 1, status: 'ACTIVE' }),

    // Ciudades con al menos 1 actividad visible
    prisma.city.count({
      where: {
        locations: {
          some: {
            activities: { some: { status: 'ACTIVE' } },
          },
        },
      },
    }),

    // Proveedores registrados
    prisma.provider.count(),

    // Categorías con al menos 1 actividad activa
    prisma.category.count({
      where: {
        activities: { some: { activity: { status: 'ACTIVE' } } },
      },
    }),

    // Top 8 categorías por número de actividades activas
    prisma.category.findMany({
      where: {
        activities: {
          some: { activity: { status: 'ACTIVE' } },
        },
      },
      include: { _count: { select: { activities: { where: { activity: { status: 'ACTIVE' } } } } } },
      orderBy: { activities: { _count: 'desc' } },
      take: 8,
    }),

    // 4 actividades más recientes (una fila en desktop)
    listActivities({ skip: 0, pageSize: 4, status: 'ACTIVE', sortBy: 'newest' }),

    // Fallback: 4 actividades populares (relevance) si no hay recientes
    listActivities({ skip: 0, pageSize: 4, status: 'ACTIVE', sortBy: 'relevance' }),
  ] as const);

  if (totalActivitiesResult.status === 'rejected') {
    logHomeQueryFailure('totalActivities', totalActivitiesResult.reason);
  }
  if (totalCitiesResult.status === 'rejected') {
    logHomeQueryFailure('totalCities', totalCitiesResult.reason);
  }
  if (totalProvidersResult.status === 'rejected') {
    logHomeQueryFailure('totalProviders', totalProvidersResult.reason);
  }
  if (totalCategoriesResult.status === 'rejected') {
    logHomeQueryFailure('totalCategories', totalCategoriesResult.reason);
  }
  if (topCategoriesResult.status === 'rejected') {
    logHomeQueryFailure('topCategories', topCategoriesResult.reason);
  }
  if (recentActivitiesResult.status === 'rejected') {
    logHomeQueryFailure('recentActivities', recentActivitiesResult.reason);
  }
  if (popularActivitiesResult.status === 'rejected') {
    logHomeQueryFailure('popularActivities', popularActivitiesResult.reason);
  }

  const totalActivities =
    totalActivitiesResult.status === 'fulfilled' ? totalActivitiesResult.value.total : 0;
  const totalCities =
    totalCitiesResult.status === 'fulfilled' ? totalCitiesResult.value : 0;
  const totalProviders =
    totalProvidersResult.status === 'fulfilled' ? totalProvidersResult.value : 0;
  const totalCategories =
    totalCategoriesResult.status === 'fulfilled' ? totalCategoriesResult.value : 0;
  const topCategories =
    topCategoriesResult.status === 'fulfilled' ? topCategoriesResult.value : [];
  const recentActivities =
    recentActivitiesResult.status === 'fulfilled' ? recentActivitiesResult.value.activities : [];
  const popularActivities =
    popularActivitiesResult.status === 'fulfilled' ? popularActivitiesResult.value.activities : [];

  // Lógica de fallback para la sección de actividades
  const hasRecent   = recentActivities.length > 0;
  const hasPopular  = popularActivities.length > 0;
  const displayActivities = hasRecent ? recentActivities : popularActivities;
  const activitySubtitle  = hasRecent ? 'Las más recientes' : 'Las más populares';
  const activityHref      = hasRecent ? '/actividades?sort=newest' : '/actividades';

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ================================================================ */}
      {/* HERO                                                              */}
      {/* ================================================================ */}
      <section className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:py-20 text-center">

          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-3">
            ¿Qué hacemos{' '}
            <span className="text-indigo-600">hoy?</span>
          </h1>

          <div className="max-w-xl mx-auto mb-8">
            <p className="text-lg text-gray-500">
              Descubre planes en familia cerca de ti
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Actividades para niños y familias en Bogotá
            </p>
          </div>

          {/* Buscador principal */}
          <div className="mb-12">
            <HeroSearch />
          </div>

          {/* Stats reales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mx-auto">
            <StatBox value={totalActivities} label="actividades" />
            <StatBox value={totalCities} label={totalCities === 1 ? 'ciudad' : 'ciudades'} />
            <StatBox value={totalCategories} label="categorías" />
            <StatBox value={totalProviders} label={totalProviders === 1 ? 'fuente' : 'fuentes'} />
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* CATEGORÍAS DESTACADAS                                            */}
      {/* ================================================================ */}
      {topCategories.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-10 pb-12">
          <SectionHeader title="Explora por tipo de actividad" href="/actividades" linkText="Ver todas →" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {topCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/actividades?categoryId=${cat.id}`}
                className="group flex flex-col items-center gap-2.5 rounded-2xl bg-white border border-gray-100 p-5 text-center hover:border-indigo-200 hover:shadow-md transition-all"
              >
                {/* Ícono con gradiente de la categoría */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: getCategoryGradient(cat.slug) }}
                >
                  {getCategoryEmoji(cat.name)}
                </div>
                <span className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors leading-tight">
                  {cat.name}
                </span>
                <span className="text-xs text-gray-400">
                  {cat._count.activities} {cat._count.activities === 1 ? 'actividad' : 'actividades'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* ACTIVIDADES — recientes o populares como fallback               */}
      {/* ================================================================ */}
      <section className="bg-white border-t border-b border-gray-100 py-12">
        <div className="mx-auto max-w-5xl px-4">
          {(hasRecent || hasPopular) ? (
            <>
              <SectionHeader
                title="Descubre actividades"
                subtitle={activitySubtitle}
                href={activityHref}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {displayActivities.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} compact />
                ))}
              </div>
              <div className="mt-8 text-center">
                <Link
                  href={activityHref}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-indigo-600 px-8 py-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"
                >
                  Ver más actividades →
                </Link>
              </div>
            </>
          ) : (
            /* Empty state: no hay ninguna actividad disponible */
            <div className="text-center py-8">
              <p className="text-lg font-semibold text-gray-700 mb-1">
                No hay actividades nuevas por ahora
              </p>
              <p className="text-sm text-gray-400 mb-6">
                Explora todas las actividades disponibles
              </p>
              <Link
                href="/actividades"
                className="inline-flex items-center gap-2 rounded-full border-2 border-indigo-600 px-8 py-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"
              >
                Ver más actividades →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ================================================================ */}
      {/* CTA FINAL                                                        */}
      {/* ================================================================ */}
      <section className="mx-auto max-w-5xl px-4 py-12 text-center">
        <div className="rounded-3xl bg-indigo-600 px-8 py-10">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            ¿No encontraste algo que te guste?
          </h2>
          <p className="text-indigo-200 mb-7 max-w-md mx-auto text-sm">
            Descubre más actividades filtrando por edad, precio o ubicación
          </p>
          <Link
            href="/actividades"
            className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors shadow"
          >
            Ver más actividades →
          </Link>
        </div>
      </section>

    </div>
  );
}

// =============================================================================
// Componentes auxiliares (sólo usados en esta página)
// =============================================================================

function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-3xl font-bold text-gray-900 tabular-nums">
        {value.toLocaleString('es-CO')}
      </span>
      <span className="text-sm text-gray-500">{label}</span>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  href,
  linkText,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkText?: string;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 leading-snug">{title}</h2>
        {subtitle && (
          <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {href && linkText && (
        <Link href={href} className="text-sm text-indigo-600 hover:underline font-medium shrink-0 mt-0.5">
          {linkText}
        </Link>
      )}
    </div>
  );
}
