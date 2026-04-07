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

export const metadata: Metadata = {
  title: 'HabitaPlan — Actividades para niños y familias en Colombia',
  description:
    'Descubre talleres, clubes, campamentos y eventos para niños y familias en Colombia. Todo en un solo lugar, siempre actualizado.',
};

// Tipos de actividad con icono y color para filtros rápidos
const ACTIVITY_TYPES = [
  { value: 'WORKSHOP',  label: 'Talleres',    emoji: '🎨', color: 'bg-orange-50 border-orange-100 text-orange-700 hover:border-orange-300' },
  { value: 'CAMP',      label: 'Campamentos', emoji: '⛺', color: 'bg-green-50  border-green-100  text-green-700  hover:border-green-300'  },
  { value: 'RECURRING', label: 'Recurrentes', emoji: '🔄', color: 'bg-blue-50   border-blue-100   text-blue-700   hover:border-blue-300'   },
  { value: 'ONE_TIME',  label: 'Eventos',     emoji: '📅', color: 'bg-purple-50 border-purple-100 text-purple-700 hover:border-purple-300' },
] as const;

export default async function HomePage() {
  // Todas las queries en paralelo
  const [
    { total: totalActivities },
    totalCities,
    totalProviders,
    totalCategories,
    topCategories,
    { activities: recentActivities },
    typeCounts,
  ] = await Promise.all([
    // Total de actividades activas (visible en la plataforma)
    listActivities({ skip: 0, pageSize: 1, status: 'ACTIVE' }),

    // Ciudades con al menos 1 actividad visible
    prisma.city.count({
      where: {
        locations: {
          some: {
            activities: { some: { status: { in: ['ACTIVE', 'EXPIRED'] } } },
          },
        },
      },
    }),

    // Proveedores registrados
    prisma.provider.count(),

    // Categorías con al menos 1 actividad
    prisma.category.count({
      where: {
        activities: { some: { activity: { status: { in: ['ACTIVE', 'EXPIRED'] } } } },
      },
    }),

    // Top 8 categorías por número de actividades
    prisma.category.findMany({
      where: {
        activities: {
          some: { activity: { status: { in: ['ACTIVE', 'EXPIRED'] } } },
        },
      },
      include: { _count: { select: { activities: true } } },
      orderBy: { activities: { _count: 'desc' } },
      take: 8,
    }),

    // 8 actividades más recientes
    listActivities({ skip: 0, pageSize: 8, status: 'ACTIVE', sortBy: 'newest' }),

    // Conteo por tipo (para filtros rápidos)
    prisma.activity.groupBy({
      by: ['type'],
      where: { status: { in: ['ACTIVE', 'EXPIRED'] } },
      _count: { _all: true },
    }),
  ]);

  const typeCountMap = Object.fromEntries(typeCounts.map((t) => [t.type, t._count._all]));

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ================================================================ */}
      {/* HERO                                                              */}
      {/* ================================================================ */}
      <section className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20 text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-6">
            <span>✨</span>
            <span>La agenda de actividades para familias en Colombia</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4">
            ¿Qué hacemos{' '}
            <span className="text-indigo-600">este fin de semana?</span>
          </h1>

          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10">
            Talleres, clubes, campamentos y eventos para niños y familias.
            Información centralizada, siempre actualizada.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
            <Link
              href="/actividades"
              className="rounded-full bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              Explorar actividades →
            </Link>
            <Link
              href="/actividades?price=free"
              className="rounded-full border border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Solo gratuitas 🎁
            </Link>
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
      {/* FILTROS RÁPIDOS POR TIPO                                         */}
      {/* ================================================================ */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ACTIVITY_TYPES.map((t) => {
            const count = typeCountMap[t.value] ?? 0;
            if (!count) return null;
            return (
              <Link
                key={t.value}
                href={`/actividades?type=${t.value}`}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border px-4 py-4 text-center transition-all ${t.color}`}
              >
                <span className="text-2xl">{t.emoji}</span>
                <span className="text-sm font-semibold">{t.label}</span>
                <span className="text-xs opacity-70">{count} actividades</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ================================================================ */}
      {/* CATEGORÍAS DESTACADAS                                            */}
      {/* ================================================================ */}
      {topCategories.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pb-12">
          <SectionHeader title="Explora por categoría" href="/actividades" linkText="Ver todas →" />
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
      {/* ACTIVIDADES RECIENTES                                            */}
      {/* ================================================================ */}
      {recentActivities.length > 0 && (
        <section className="bg-white border-t border-b border-gray-100 py-12">
          <div className="mx-auto max-w-5xl px-4">
            <SectionHeader
              title="Recién agregadas"
              href="/actividades?sort=newest"
              linkText="Ver más →"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recentActivities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* CTA FINAL                                                        */}
      {/* ================================================================ */}
      <section className="mx-auto max-w-5xl px-4 py-16 text-center">
        <div className="rounded-3xl bg-indigo-600 px-8 py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            ¿No encuentras lo que buscas?
          </h2>
          <p className="text-indigo-200 mb-8 max-w-md mx-auto">
            Usa los filtros avanzados para encontrar la actividad perfecta
            por edad, precio, categoría y más.
          </p>
          <Link
            href="/actividades"
            className="inline-block rounded-full bg-white px-8 py-3.5 text-base font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors shadow"
          >
            Explorar con filtros →
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
  href,
  linkText,
}: {
  title: string;
  href: string;
  linkText: string;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <Link href={href} className="text-sm text-indigo-600 hover:underline font-medium">
        {linkText}
      </Link>
    </div>
  );
}
