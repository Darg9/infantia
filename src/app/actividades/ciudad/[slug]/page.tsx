// =============================================================================
// /actividades/ciudad/[slug] — Landing SEO por ciudad
// El slug se genera desde el nombre de la ciudad (slugify)
// Ej: "Bogotá" → "bogota", "Cartagena de Indias" → "cartagena-de-indias"
// =============================================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { listActivities } from '@/modules/activities';
import { SITE_URL } from '@/config/site';
import { slugify } from '@/lib/slugify';
import { FilterLandingLayout } from '../../_components/FilterLandingLayout';

const PAGE_LIMIT = 24;

async function getCityBySlug(slug: string) {
  const cities = await prisma.city.findMany({
    where: { isActive: true },
    select: { id: true, name: true, countryName: true },
  });
  return cities.find((c) => slugify(c.name) === slug) ?? null;
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const city = await getCityBySlug(slug);
  if (!city) return {};

  const title = `Actividades para niños y familias en ${city.name}`;
  const description = `Descubre talleres, eventos, cursos y campamentos para niños y familias en ${city.name}. Todo en un solo lugar.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | HabitaPlan`,
      description,
    },
    alternates: {
      canonical: `/actividades/ciudad/${slug}`,
    },
  };
}

export async function generateStaticParams() {
  const cities = await prisma.city.findMany({
    where: { isActive: true },
    select: { name: true },
  });
  return cities.map((c) => ({ slug: slugify(c.name) }));
}

export default async function CiudadLandingPage({ params }: Props) {
  const { slug } = await params;
  const city = await getCityBySlug(slug);
  if (!city) notFound();

  const { activities } = await listActivities({
    skip: 0,
    pageSize: PAGE_LIMIT,
    cityId: city.id,
    sortBy: 'date',
  });

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Actividades', item: `${SITE_URL}/actividades` },
      { '@type': 'ListItem', position: 3, name: city.name, item: `${SITE_URL}/actividades/ciudad/${slug}` },
    ],
  };

  return (
    <FilterLandingLayout
      title={`Actividades para niños y familias en ${city.name}`}
      description={`Talleres, cursos, campamentos y eventos para niños y familias en ${city.name}. Encuentra el plan perfecto cerca de ti.`}
      breadcrumbs={[
        { name: 'Inicio', href: '/' },
        { name: 'Actividades', href: '/actividades' },
        { name: city.name, href: `/actividades/ciudad/${slug}` },
      ]}
      activities={activities}
      filterUrl={`/actividades?cityId=${city.id}`}
      filterLabel={`Ver todas las actividades en ${city.name}`}
      breadcrumbLd={breadcrumbLd}
    />
  );
}
