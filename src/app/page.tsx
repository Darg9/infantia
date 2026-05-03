// =============================================================================
// Home — Landing page de HabitaPlan
// Server Component: stats reales, categorías destacadas, actividades recientes
// =============================================================================

import type { Metadata } from 'next';
import Link from 'next/link';
import { listActivities } from '@/modules/activities';
import { prisma } from '@/lib/db';
import { buildActivityWhere } from '@/modules/activities/activity-filters';
import ActivityCard from '@/app/actividades/_components/ActivityCard';
import HeroSearch from '@/app/_components/HeroSearch';
import { serializeActivity } from '@/lib/prisma-serialize';
import { CitySwitcher } from '@/components/layout/CitySwitcher';
import { CategoryCountsIsland } from '@/app/_components/CategoryCountsIsland';
import { getCitiesForSelector } from '@/lib/cities';

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
  // Filtro de calidad para conteos de categorías:
  // Excluye fuentes con score < 0.1 (dead sources) igual que listActivities en relevance.
  // Esto hace que los conteos del home coincidan ~80% con lo que el usuario verá en la página
  // (el 20% restante es el threshold de ranking score JS, no replicable en SQL).
  const badDomainSources = await prisma.sourceHealth.findMany({
    where: { score: { lt: 0.1 } },
    select: { source: true },
  });
  const badDomains = badDomainSources.map((h) => h.source);
  const qualityFilter = buildActivityWhere({ status: 'ACTIVE', badDomains });

  // Home resiliente: una query rota no debe tumbar todo el portal.
  const [
    totalActivitiesResult,
    topCategoriesResult,
    recentActivitiesResult,
    popularActivitiesResult,
  ] = await Promise.allSettled([
    // Total de actividades activas (mismo criterio que las categorías)
    listActivities({ skip: 0, pageSize: 1, status: 'ACTIVE' }),

    // Top 8 categorías — mismo filtro de calidad que listActivities (relevance)
    // para que los conteos coincidan con lo que el usuario verá al hacer clic.
    prisma.category.findMany({
      where: {
        activities: {
          some: { activity: qualityFilter },
        },
      },
      include: { _count: { select: { activities: { where: { activity: qualityFilter } } } } },
      orderBy: { activities: { _count: 'desc' } },
      take: 8,
    }),

    // 4 actividades más recientes (una fila en desktop)
    listActivities({ skip: 0, pageSize: 4, status: 'ACTIVE', sortBy: 'newest' }),

    // Fallback: 4 actividades populares (relevance) si no hay recientes
    listActivities({ skip: 0, pageSize: 4, status: 'ACTIVE', sortBy: 'relevance' }),

  ] as const);

  // Ciudades para CitySwitcher hero — query separada con conteo doble (strict + OR).
  // Fuera del allSettled para simplificar tipos; falla silenciosa → selector oculto.
  let cities: Awaited<ReturnType<typeof getCitiesForSelector>> = [];
  try {
    cities = await getCitiesForSelector();
  } catch {
    // fallback silencioso — CitySwitcher no renderiza si cities=[]
  }

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
    <div>
      {/* ================================================================ */}
      {/* HERO                                                              */}
      {/* ================================================================ */}
      <section className="bg-[var(--hp-bg-surface)] border-b border-[var(--hp-border)]">
        <div className="mx-auto max-w-5xl px-4 pt-6 pb-5 sm:pt-8 sm:pb-6 text-center">

          <h1 className="text-4xl sm:text-5xl font-bold text-[var(--hp-text-primary)] leading-tight mb-2">
            ¿Qué hacemos{' '}
            <span className="text-hp-action-primary">hoy?</span>
          </h1>

          <p className="text-sm text-[var(--hp-text-muted)] mb-2">
            <span className="text-hp-action-primary font-semibold tabular-nums">
              {totalActivities.toLocaleString('es-CO')}
            </span>{" "}
            {totalActivities === 1
              ? 'actividad para niños y familias'
              : 'actividades para niños y familias'}
          </p>

          {/* Cápsula unificada: ciudad + buscador como un solo sistema visual
              Mobile: stack — ciudad arriba (border-b), buscador abajo (ancho completo)
              Desktop (sm+): fila — [Colombia ▼ |] [Buscar...] con divisor vertical
              focus-within: el ring se aplica en la cápsula, no en el input interno */}
          <div className='mb-2 max-w-2xl mx-auto rounded-2xl shadow-[var(--hp-shadow-[var(--hp-shadow-md)])] border border-[var(--hp-border-subtle)] bg-[var(--hp-bg-elevated)] overflow-hidden flex flex-col sm:flex-row focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 transition-all'>
            <CitySwitcher cities={cities} variant="hero" unified />
            <div className="flex-1 min-w-0">
              <HeroSearch unified />
            </div>
          </div>
          {/* Chips rápidos — fuera de la cápsula para no quedar dentro del borde */}
          <div className="flex gap-2.5 justify-center mt-3 flex-wrap">
            <Link href="/actividades?sort=date" className='inline-flex items-center px-3 py-1.5 rounded-full border border-[var(--hp-border-subtle)] bg-[var(--hp-bg-elevated)] text-sm text-[var(--hp-text-primary)] hover:bg-[var(--hp-bg-subtle)] hover:border-brand-400 hover:text-brand-600 shadow-[var(--hp-shadow-[var(--hp-shadow-md)])] font-medium transition-all whitespace-nowrap'>Hoy</Link>
            <Link href="/actividades?price=free" className='inline-flex items-center px-3 py-1.5 rounded-full border border-[var(--hp-border-subtle)] bg-[var(--hp-bg-elevated)] text-sm text-[var(--hp-text-primary)] hover:bg-[var(--hp-bg-subtle)] hover:border-brand-400 hover:text-brand-600 shadow-[var(--hp-shadow-[var(--hp-shadow-md)])] font-medium transition-all whitespace-nowrap'>Gratis</Link>
            <Link href="/actividades?search=conversatorios" className='inline-flex items-center px-3 py-1.5 rounded-full border border-[var(--hp-border-subtle)] bg-[var(--hp-bg-elevated)] text-sm text-[var(--hp-text-primary)] hover:bg-[var(--hp-bg-subtle)] hover:border-brand-400 hover:text-brand-600 shadow-[var(--hp-shadow-[var(--hp-shadow-md)])] font-medium transition-all whitespace-nowrap'>Conversatorios</Link>
            <Link href="/mapa" className='inline-flex items-center px-3 py-1.5 rounded-full border border-[var(--hp-border-subtle)] bg-[var(--hp-bg-elevated)] text-sm text-[var(--hp-text-primary)] hover:bg-[var(--hp-bg-subtle)] hover:border-brand-400 hover:text-brand-600 shadow-[var(--hp-shadow-[var(--hp-shadow-md)])] font-medium transition-all whitespace-nowrap'>Cerca de ti</Link>
          </div>
        </div>
      </section>
      {/* ================================================================ */}
      {/* CATEGORÍAS DESTACADAS                                            */}
      {/* ================================================================ */}
      {topCategories.length > 0 && (
        <section id="categorias" className="hp-section-alt mx-auto max-w-5xl px-4 pt-4 pb-10 sm:pb-10">
          <SectionHeader title="Explora por tipo de actividad" href="/actividades" linkText="Ver todas →" />
          {/*
            CategoryCountsIsland: Server renderiza con conteos globales (calidad-filtrados).
            Cliente, post-mount, hace UN fetch con cityId del usuario y actualiza los
            números silenciosamente. Sin layout shift — el número se intercambia in-place.
          */}
          <CategoryCountsIsland
            categories={topCategories.map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              initialCount: c._count.activities,
            }))}
          />
        </section>
      )}
      {/* ================================================================ */}
      {/* ACTIVIDADES — recientes o populares como fallback               */}
      {/* ================================================================ */}
      <section className="bg-[var(--hp-bg-surface)] border-t border-b border-[var(--hp-border)] pt-6 pb-8 md:pb-10">
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
                  <ActivityCard key={activity.id} activity={serializeActivity(activity)} compact />
                ))}
              </div>
              <div className="mt-8 text-center">
                <Link
                  href={activityHref}
                  className='inline-flex items-center gap-2 rounded-full border-2 border-hp-action-primary px-8 py-3 text-sm font-semibold text-hp-action-primary hover:bg-hp-action-primary hover:text-white hover:shadow-[var(--hp-shadow-[var(--hp-shadow-md)])] transition-all'
                >
                  Explorar todas las actividades →
                </Link>
              </div>
            </>
          ) : (
            /* Empty state: no hay ninguna actividad disponible */
            (<div className="text-center py-8">
              <p className="text-lg font-semibold text-[var(--hp-text-primary)] mb-1">
                No hay actividades nuevas por ahora
              </p>
              <p className="text-sm text-[var(--hp-text-muted)] mb-8">
                Explora todas las actividades disponibles
              </p>
              <Link
                href="/actividades"
                className='inline-flex items-center gap-2 rounded-full border-2 border-hp-action-primary px-8 py-3 text-sm font-semibold text-hp-action-primary hover:bg-hp-action-primary hover:text-white hover:shadow-[var(--hp-shadow-[var(--hp-shadow-md)])] transition-all'
              >
                Explorar todas las actividades →
              </Link>
            </div>)
          )}
          {/* ================================================================ */}
          {/* B2B CTA — Captación de organizadores                            */}
          {/* ================================================================ */}
          {/* Spacer: separa visualmente el flujo B2C (explorar) del B2B (publicar) */}
          <div className="mt-16 md:mt-20" />
          <div className="text-center max-w-2xl mx-auto bg-[var(--hp-bg-elevated)] border border-[var(--hp-border-subtle)] shadow-[0_8px_24px_rgba(0,0,0,0.06)] rounded-2xl p-6 md:p-8">
            <h3 className="text-base md:text-lg font-semibold text-[var(--hp-text-primary)]">
              ¿Ofreces actividades para niños y familias?
            </h3>
            <p className="text-sm text-[var(--hp-text-muted)] mt-1.5">
              Llega a más interesados cerca de ti.
            </p>
            <Link
              href="https://www.habitaplan.com/anunciate"
              className='inline-flex items-center gap-1.5 mt-5 px-6 py-2.5 rounded-full bg-hp-action-primary text-white text-sm font-semibold hover:bg-hp-action-primary-hover shadow-[var(--hp-shadow-[var(--hp-shadow-md)])] transition-all'
            >
              Publica tu plan →
            </Link>
          </div>
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
    <div className="flex items-start justify-between mb-2">
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

