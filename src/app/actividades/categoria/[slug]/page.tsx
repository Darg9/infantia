// =============================================================================
// /actividades/categoria/[slug] — Landing SEO por categoría
// =============================================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { listActivities } from '@/modules/activities';
import { SITE_URL } from '@/config/site';
import { FilterLandingLayout } from '../../_components/FilterLandingLayout';

const PAGE_LIMIT = 24;

interface Props {
  params: Promise<{ slug: string }>;
}

async function getCategory(slug: string) {
  return prisma.category.findFirst({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return {};

  const title = `Actividades de ${category.name} para niños y familias en Colombia`;
  const description = `Descubre talleres, cursos y eventos de ${category.name} para niños y familias. Filtra por edad, precio y ciudad.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | HabitaPlan`,
      description,
    },
    alternates: {
      canonical: `/actividades/categoria/${slug}`,
    },
  };
}

export async function generateStaticParams() {
  const categories = await prisma.category.findMany({
    select: { slug: true },
  });
  return categories.map((c) => ({ slug: c.slug }));
}

export default async function CategoriaLandingPage({ params }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  const { activities } = await listActivities({
    skip: 0,
    pageSize: PAGE_LIMIT,
    categoryId: category.id,
    sortBy: 'date',
  });

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Actividades', item: `${SITE_URL}/actividades` },
      { '@type': 'ListItem', position: 3, name: category.name, item: `${SITE_URL}/actividades/categoria/${slug}` },
    ],
  };

  return (
    <FilterLandingLayout
      title={`Actividades de ${category.name}`}
      description={`Talleres, cursos, campamentos y eventos de ${category.name} para niños y familias en Colombia.`}
      breadcrumbs={[
        { name: 'Inicio', href: '/' },
        { name: 'Actividades', href: '/actividades' },
        { name: category.name, href: `/actividades/categoria/${slug}` },
      ]}
      activities={activities}
      filterUrl={`/actividades?categoryId=${category.id}`}
      filterLabel={`Ver todas las actividades de ${category.name}`}
      breadcrumbLd={breadcrumbLd}
    />
  );
}
