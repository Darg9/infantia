// =============================================================================
// FilterLandingLayout — Layout compartido para páginas SEO de filtros
// Usado por: /actividades/categoria, /publico, /precio, /ciudad
// =============================================================================

import Link from 'next/link';
import ActivityCard from './ActivityCard';

interface Breadcrumb {
  name: string;
  href: string;
}

// Tipo mínimo compatible con ActivityCard
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActivityItem = any;

interface FilterLandingLayoutProps {
  /** H1 de la página */
  title: string;
  /** Párrafo descriptivo debajo del título */
  description: string;
  /** Ruta de migas de pan */
  breadcrumbs: Breadcrumb[];
  /** Actividades a mostrar */
  activities: ActivityItem[];
  /** URL del listado con filtro aplicado para el CTA "Ver todas" */
  filterUrl: string;
  /** Etiqueta del CTA */
  filterLabel: string;
  /** JSON-LD de breadcrumb (ya serializado) */
  breadcrumbLd: object;
}

export function FilterLandingLayout({
  title,
  description,
  breadcrumbs,
  activities,
  filterUrl,
  filterLabel,
  breadcrumbLd,
}: FilterLandingLayoutProps) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <div className="min-h-screen bg-[var(--hp-bg-page)]">

        {/* Breadcrumb */}
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <nav aria-label="Ruta de navegación" className="flex items-center gap-1.5 text-sm text-[var(--hp-text-muted)] flex-wrap">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-1.5">
                {i > 0 && <span>/</span>}
                {i < breadcrumbs.length - 1 ? (
                  <Link href={crumb.href} className='hover:text-[var(--hp-text-secondary)] transition-colors'>
                    {crumb.name}
                  </Link>
                ) : (
                  <span className='text-[var(--hp-text-secondary)]'>{crumb.name}</span>
                )}
              </span>
            ))}
          </nav>
        </div>

        {/* Header */}
        <div className="mx-auto max-w-5xl px-4 pt-6 pb-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--hp-text-primary)] leading-tight mb-2">
            {title}
          </h1>
          <p className="text-[var(--hp-text-secondary)] text-base max-w-2xl">{description}</p>
        </div>

        {/* Grid de actividades */}
        <div className="mx-auto max-w-5xl px-4 pb-12">
          {activities.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activities.map((activity: ActivityItem) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>

              {/* CTA al listado completo con filtro */}
              <div className="mt-8 flex justify-center">
                <Link
                  href={filterUrl}
                  className='inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-[var(--hp-shadow-[var(--hp-shadow-md)])] hover:bg-brand-700 transition-colors'
                >
                  {filterLabel}
                  <span>→</span>
                </Link>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="text-5xl mb-4">🔍</span>
              <p className="text-[var(--hp-text-secondary)] text-base">No encontramos actividades en esta categoría todavía.</p>
              <Link href="/actividades" className="mt-4 text-sm text-brand-600 hover:underline">
                Ver todas las actividades
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
