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
    topCategoriesResult,
    recentActivitiesResult,
    popularActivitiesResult,
  ] = await Promise.allSettled([
    // Total de actividades activas (visible en la plataforma)
    listActivities({ skip: 0, pageSize: 1, status: 'ACTIVE' }),

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
    <div className="min-h-screen bg-[var(--hp-bg-page)]">

      {/* ================================================================ */}
      {/* HERO                                                              */}
      {/* ================================================================ */}
      <section className="bg-[var(--hp-bg-surface)] border-b border-[var(--hp-border)]">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8 text-center">

          <h1 className="text-4xl sm:text-5xl font-bold text-[var(--hp-text-primary)] leading-tight mb-2">
            ¿Qué hacemos{' '}
            <span className="text-hp-action-primary">hoy?</span>
          </h1>

          <div className="max-w-xl mx-auto mb-5">
            <p className="text-lg text-[var(--hp-text-secondary)]">
              Descubre planes en familia cerca de ti
            </p>
            <p className="text-sm text-[var(--hp-text-muted)] mt-1">
              <span className="text-hp-action-primary font-semibold tabular-nums">
                {totalActivities.toLocaleString('es-CO')}
              </span>{" "}
              {totalActivities === 1
                ? 'actividad para niños y familias'
                : 'actividades para niños y familias'}
            </p>
          </div>

          {/* Buscador principal */}
          <div className="mb-3">
            <HeroSearch />
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* CATEGORÍAS DESTACADAS                                            */}
      {/* ================================================================ */}
      {topCategories.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-5">
          <SectionHeader title="Explora por tipo de actividad" href="/actividades" linkText="Ver todas →" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {topCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/actividades?categoryId=${cat.id}`}
                className="group flex flex-col items-center gap-2.5 rounded-2xl bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] p-5 text-center hover:border-brand-300 hover:shadow-md transition-all"
              >
                {/* Ícono con gradiente de la categoría */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: getCategoryGradient(cat.slug) }}
                >
                  {getCategoryEmoji(cat.name)}
                </div>
                <span className="text-sm font-semibold text-[var(--hp-text-primary)] group-hover:text-hp-action-primary transition-colors leading-tight">
                  {cat.name}
                </span>
                <span className="text-xs text-[var(--hp-text-muted)]">
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
      <section className="bg-[var(--hp-bg-surface)] border-t border-b border-[var(--hp-border)] py-6">
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
              <div className="mt-5 text-center">
                <Link
                  href={activityHref}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-hp-action-primary px-8 py-3 text-sm font-semibold text-hp-action-primary hover:bg-hp-action-primary hover:text-white transition-all"
                >
                  Ver más actividades →
                </Link>
              </div>
            </>
          ) : (
            /* Empty state: no hay ninguna actividad disponible */
            <div className="text-center py-8">
              <p className="text-lg font-semibold text-[var(--hp-text-primary)] mb-1">
                No hay actividades nuevas por ahora
              </p>
              <p className="text-sm text-[var(--hp-text-muted)] mb-6">
                Explora todas las actividades disponibles
              </p>
              <Link
                href="/actividades"
                className="inline-flex items-center gap-2 rounded-full border-2 border-hp-action-primary px-8 py-3 text-sm font-semibold text-hp-action-primary hover:bg-hp-action-primary hover:text-white transition-all"
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
      <section className="mx-auto max-w-5xl px-4 py-6 text-center">
        <div className="rounded-3xl bg-brand-600 px-8 py-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            ¿No encontraste algo que te guste?
          </h2>
          <p className="text-brand-100 mb-4 max-w-md mx-auto text-sm">
            Descubre más actividades filtrando por edad, precio o ubicación
          </p>
          <Link
            href="/actividades"
            className="inline-flex items-center gap-2 rounded-full bg-hp-bg-surface px-8 py-3 text-sm font-semibold text-hp-text-primary hover:bg-hp-bg-subtle transition-colors shadow"
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
    <div className="flex items-start justify-between mb-3">
      <div>
        <h2 className="text-lg font-bold text-[var(--hp-text-primary)] leading-snug">{title}</h2>
        {subtitle && (
          <p className="text-sm text-[var(--hp-text-muted)] mt-0.5">{subtitle}</p>
        )}
      </div>
      {href && linkText && (
        <Link href={href} className="text-sm text-hp-action-primary hover:underline font-medium shrink-0 mt-0.5">
          {linkText}
        </Link>
      )}
    </div>
  );
}

