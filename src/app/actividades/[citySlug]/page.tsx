// =============================================================================
// /actividades/[citySlug] — Landing SEO por ciudad
// ISR: se construye en el primer request y se cachea 1h.
// generateStaticParams eliminado para evitar EMAXCONN en build
// (Supabase free tier: límite 200 conexiones simultáneas).
// =============================================================================

export const revalidate = 3600 // 1 hora — revalida en background tras cada hora

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { SITE_URL } from '@/config/site';
import { slugify } from '@/lib/slugify';
import ActivityCard from '../_components/ActivityCard';
import { getCategoryEmoji } from '@/lib/category-utils';

const PAGE_LIMIT = 12;

async function getCityBySlug(slug: string) {
  const cities = await prisma.city.findMany({
    where: { isActive: true },
    select: { id: true, name: true, countryName: true },
  });
  return cities.find((c) => slugify(c.name) === slug) ?? null;
}

interface Props {
  params: Promise<{ citySlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { citySlug } = await params;
  const city = await getCityBySlug(citySlug);
  if (!city) return {};

  const currentYear = new Date().getFullYear();
  const title = `Actividades para niños en ${city.name} (${currentYear}) | Planes familiares hoy`;
  const description = `Descubre actividades para niños y familias en ${city.name}: campamentos, talleres, eventos gratis, deporte, arte y planes para disfrutar hoy o el fin de semana.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | HabitaPlan`,
      description,
    },
    alternates: {
      canonical: `/actividades/${citySlug}`,
    },
  };
}

export default async function CiudadLandingPage({ params }: Props) {
  const { citySlug } = await params;
  const city = await getCityBySlug(citySlug);
  if (!city) notFound();

  // Parallel data fetching for speed
  const [activities, totalActivities, allCategories, topProviders] = await Promise.all([
    prisma.activity.findMany({
      where: { location: { cityId: city.id }, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: PAGE_LIMIT,
      include: { location: { include: { city: true } }, categories: { include: { category: true } }, provider: true },
    }),
    prisma.activity.count({
      where: { location: { cityId: city.id }, status: 'ACTIVE' },
    }),
    prisma.category.findMany({
      include: { _count: { select: { activities: true } } },
    }),
    prisma.provider.findMany({
      where: { activities: { some: { location: { cityId: city.id }, status: 'ACTIVE' } } },
      take: 6,
      orderBy: { activities: { _count: 'desc' } }, // Organizadores con más oferta
    }),
  ]);

  const popularCategories = allCategories
    .sort((a, b) => b._count.activities - a._count.activities)
    .slice(0, 6);

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Actividades', item: `${SITE_URL}/actividades` },
      { '@type': 'ListItem', position: 3, name: city.name, item: `${SITE_URL}/actividades/${citySlug}` },
    ],
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `¿Qué actividades para niños hay hoy en ${city.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `En HabitaPlan tenemos más de ${totalActivities} planes activos en ${city.name}, incluyendo talleres de arte, campamentos, deportes y eventos culturales para todas las edades.`,
        },
      },
      {
        '@type': 'Question',
        name: `¿Hay planes gratis para niños en ${city.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Sí, contamos con una gran variedad de actividades gratuitas organizadas por bibliotecas públicas, museos y alcaldías locales en ${city.name}.`,
        },
      },
    ],
  };

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: activities.map((act, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Event',
        url: `${SITE_URL}/actividad/${act.id}-${slugify(act.title)}`,
        name: act.title,
      },
    })),
  };

  const todayStr = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <main className="min-h-screen bg-[var(--hp-bg-page)] pb-20">
        
        {/* HERO SECTION */}
        <section className="bg-[var(--hp-bg-surface)] border-b border-[var(--hp-border)] pt-12 pb-16 px-4">
          <div className="max-w-6xl mx-auto text-center space-y-6">
            
            {/* Freshness Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--hp-badge-fresh-bg)] px-3 py-1 text-sm font-medium text-[var(--hp-badge-fresh-text)] ring-1 ring-inset ring-[var(--hp-badge-fresh-ring)]">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--hp-badge-fresh-dot)]"></span>
              </span>
              Actualizado hoy ({todayStr}) · {totalActivities} planes en vivo
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--hp-text-primary)]">
              Qué hacer con niños en <span className="text-brand-600">{city.name}</span> hoy y este fin de semana
            </h1>
            
            {/* Intro Semántica */}
            <p className="text-lg md:text-xl text-[var(--hp-text-secondary)] max-w-3xl mx-auto font-medium leading-relaxed">
              Descubre actividades para niños y familias en {city.name}: campamentos, talleres, eventos gratis, deporte, arte y planes para disfrutar hoy o el fin de semana.
            </p>
            
            <div className="pt-4">
              <Link href={`/actividades?cityId=${city.id}`} className='inline-flex items-center justify-center rounded-full bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-[var(--hp-shadow-[var(--hp-shadow-md)])] hover:bg-brand-500 transition-colors'>
                Explorar {totalActivities} actividades en {city.name}
              </Link>
            </div>
          </div>
        </section>

        {/* MODULO 1: TOP ACTIVIDADES */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-[var(--hp-text-primary)]">Planes destacados esta semana</h2>
              <p className="text-[var(--hp-text-secondary)] mt-1">Los favoritos de las familias en {city.name}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {activities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity as any} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href={`/actividades?cityId=${city.id}`} className='inline-flex items-center justify-center rounded-xl bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] px-6 py-3 text-sm font-semibold text-[var(--hp-text-primary)] shadow-[var(--hp-shadow-[var(--hp-shadow-md)])] hover:bg-[var(--hp-bg-subtle)] transition-colors'>
              Explorar el catálogo completo
            </Link>
          </div>
        </section>

        {/* MODULO 2: CATEGORÍAS POPULARES */}
        <section className="bg-[var(--hp-bg-subtle)] py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-[var(--hp-text-primary)] text-center mb-10">Explora por categoría</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {popularCategories.map((cat) => (
                <Link key={cat.id} href={`/actividades/categoria/${cat.slug}?cityId=${city.id}`} className='flex flex-col items-center justify-center gap-3 bg-[var(--hp-bg-surface)] p-6 rounded-2xl border border-[var(--hp-border)] hover:border-brand-300 hover:shadow-[var(--hp-shadow-[var(--hp-shadow-md)])] transition-all group'>
                  <span className="text-4xl group-hover:scale-110 transition-transform">{getCategoryEmoji(cat.name)}</span>
                  <span className="text-sm font-semibold text-[var(--hp-text-primary)] text-center leading-tight">
                    {cat.name} en {city.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* MODULO 3: ORGANIZADORES (Semilla Monetización) */}
        {topProviders.length > 0 && (
          <section className="max-w-6xl mx-auto px-4 py-16 border-b border-[var(--hp-border)]">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-[var(--hp-text-primary)]">Los mejores organizadores en {city.name}</h2>
              <p className="text-[var(--hp-text-secondary)] mt-2">Academias y entidades que crean momentos inolvidables.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {topProviders.map((provider) => (
                <div key={provider.id} className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] p-6 rounded-2xl flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[var(--hp-badge-provider-bg)] flex items-center justify-center text-xl font-bold text-[var(--hp-badge-provider-text)] shrink-0">
                    {provider.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--hp-text-primary)]">{provider.name}</h3>
                    {provider.slug && (
                      <Link href={`/proveedores/${provider.slug}`} className="text-sm text-brand-600 hover:underline">
                        Ver perfil
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* MODULO 4: FAQ SEO */}
        <section className="max-w-3xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-[var(--hp-text-primary)] text-center mb-8">Preguntas frecuentes</h2>
          <div className="space-y-4">
            <div className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl p-6">
              <h3 className="font-semibold text-[var(--hp-text-primary)] mb-2">¿Qué actividades para niños hay hoy en {city.name}?</h3>
              <p className="text-[var(--hp-text-secondary)]">En HabitaPlan tenemos más de {totalActivities} planes activos en {city.name}, incluyendo talleres de arte, campamentos, deportes y eventos culturales para todas las edades.</p>
            </div>
            <div className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl p-6">
              <h3 className="font-semibold text-[var(--hp-text-primary)] mb-2">¿Hay planes gratis para niños en {city.name}?</h3>
              <p className="text-[var(--hp-text-secondary)]">Sí, contamos con una gran variedad de actividades gratuitas organizadas por bibliotecas públicas, museos y alcaldías locales en {city.name}.</p>
            </div>
          </div>
        </section>

      </main>
    </>
  );
}
