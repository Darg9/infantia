// =============================================================================
// /actividades/publico/[slug] — Landing SEO por público objetivo
// Slugs: ninos | familia | adultos
// =============================================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listActivities } from '@/modules/activities';
import { SITE_URL } from '@/config/site';
import { FilterLandingLayout } from '../../_components/FilterLandingLayout';

const PAGE_LIMIT = 24;

const AUDIENCE_CONFIG: Record<string, {
  audience: string;
  title: string;
  description: string;
  label: string;
}> = {
  ninos: {
    audience: 'KIDS',
    title: 'Actividades para niños en Colombia',
    description: 'Talleres, cursos, clubes y eventos pensados especialmente para niños. Filtra por edad, categoría y ciudad.',
    label: 'Ver todas las actividades para niños',
  },
  familia: {
    audience: 'FAMILY',
    title: 'Actividades familiares en Colombia',
    description: 'Planes y experiencias para disfrutar en familia. Actividades para todas las edades en una sola salida.',
    label: 'Ver todas las actividades familiares',
  },
  adultos: {
    audience: 'ADULTS',
    title: 'Actividades para adultos en Colombia',
    description: 'Talleres, cursos y eventos para adultos. Aprende algo nuevo, conecta con otros y disfruta tu tiempo libre.',
    label: 'Ver todas las actividades para adultos',
  },
};

const AUDIENCE_PARAM: Record<string, string> = {
  ninos: 'KIDS',
  familia: 'FAMILY',
  adultos: 'ADULTS',
};

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const config = AUDIENCE_CONFIG[slug];
  if (!config) return {};

  return {
    title: config.title,
    description: config.description,
    openGraph: {
      title: `${config.title} | HabitaPlan`,
      description: config.description,
    },
    alternates: {
      canonical: `/actividades/publico/${slug}`,
    },
  };
}

export function generateStaticParams() {
  return Object.keys(AUDIENCE_CONFIG).map((slug) => ({ slug }));
}

export default async function PublicoLandingPage({ params }: Props) {
  const { slug } = await params;
  const config = AUDIENCE_CONFIG[slug];
  if (!config) notFound();

  const { activities } = await listActivities({
    skip: 0,
    pageSize: PAGE_LIMIT,
    audience: config.audience,
    sortBy: 'date',
  });

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Actividades', item: `${SITE_URL}/actividades` },
      { '@type': 'ListItem', position: 3, name: config.title.split(' en ')[0], item: `${SITE_URL}/actividades/publico/${slug}` },
    ],
  };

  return (
    <FilterLandingLayout
      title={config.title}
      description={config.description}
      breadcrumbs={[
        { name: 'Inicio', href: '/' },
        { name: 'Actividades', href: '/actividades' },
        { name: config.title.split(' en ')[0], href: `/actividades/publico/${slug}` },
      ]}
      activities={activities}
      filterUrl={`/actividades?audience=${AUDIENCE_PARAM[slug]}`}
      filterLabel={config.label}
      breadcrumbLd={breadcrumbLd}
    />
  );
}
