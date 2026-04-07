// =============================================================================
// /actividades/precio/[slug] — Landing SEO por precio
// Slugs: gratis | pagas
// =============================================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listActivities } from '@/modules/activities';
import { SITE_URL } from '@/config/site';
import { FilterLandingLayout } from '../../_components/FilterLandingLayout';

const PAGE_LIMIT = 24;

const PRICE_CONFIG: Record<string, {
  price: string;
  title: string;
  description: string;
  label: string;
}> = {
  gratis: {
    price: 'free',
    title: 'Actividades gratis para niños y familias en Colombia',
    description: 'Talleres, eventos y planes sin costo. Actividades gratuitas organizadas por bibliotecas, museos e instituciones públicas.',
    label: 'Ver todas las actividades gratuitas',
  },
  pagas: {
    price: 'paid',
    title: 'Actividades de pago para niños y familias en Colombia',
    description: 'Cursos, talleres y campamentos de calidad para niños y familias. Inversión en experiencias que valen la pena.',
    label: 'Ver todas las actividades de pago',
  },
};

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const config = PRICE_CONFIG[slug];
  if (!config) return {};

  return {
    title: config.title,
    description: config.description,
    openGraph: {
      title: `${config.title} | HabitaPlan`,
      description: config.description,
    },
    alternates: {
      canonical: `/actividades/precio/${slug}`,
    },
  };
}

export function generateStaticParams() {
  return Object.keys(PRICE_CONFIG).map((slug) => ({ slug }));
}

export default async function PrecioLandingPage({ params }: Props) {
  const { slug } = await params;
  const config = PRICE_CONFIG[slug];
  if (!config) notFound();

  const { activities } = await listActivities({
    skip: 0,
    pageSize: PAGE_LIMIT,
    price: config.price,
    sortBy: 'date',
  });

  const pageTitle = slug === 'gratis' ? 'Actividades gratuitas' : 'Actividades de pago';

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Actividades', item: `${SITE_URL}/actividades` },
      { '@type': 'ListItem', position: 3, name: pageTitle, item: `${SITE_URL}/actividades/precio/${slug}` },
    ],
  };

  return (
    <FilterLandingLayout
      title={config.title}
      description={config.description}
      breadcrumbs={[
        { name: 'Inicio', href: '/' },
        { name: 'Actividades', href: '/actividades' },
        { name: pageTitle, href: `/actividades/precio/${slug}` },
      ]}
      activities={activities}
      filterUrl={`/actividades?price=${config.price}`}
      filterLabel={config.label}
      breadcrumbLd={breadcrumbLd}
    />
  );
}
