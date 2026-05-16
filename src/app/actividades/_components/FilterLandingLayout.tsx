// =============================================================================
// FilterLandingLayout — Layout compartido para páginas SEO de filtros
// Usado por: /actividades/categoria, /publico, /precio, /ciudad
// =============================================================================

import Link from 'next/link';
import ActivityCard from './ActivityCard';
import { serializeActivity } from '@/lib/prisma-serialize';

interface Breadcrumb {
  name: string;
  href: string;
}

// Tipo mínimo compatible con ActivityCard
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActivityItem = any;

interface RelatedLink {
  label: string;
  href: string;
  emoji?: string;
}

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
  /** JSON-LD de ItemList (opcional — rich results en categorías y otras landings) */
  itemListLd?: object;
  /** JSON-LD de FAQPage (opcional — rich results FAQ) */
  faqLd?: object;
  /** Links de interlinking semántico al pie de la página (otras categorías, precio, etc.) */
  relatedLinks?: RelatedLink[];
}

export function FilterLandingLayout({
  title,
  description,
  breadcrumbs,
  activities,
  filterUrl,
  filterLabel,
  breadcrumbLd,
  itemListLd,
  faqLd,
  relatedLinks,
}: FilterLandingLayoutProps) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {itemListLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
        />
      )}
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}
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
                  <ActivityCard key={activity.id} activity={serializeActivity(activity)} />
                ))}
              </div>

              {/* CTA al listado completo con filtro */}
              <div className="mt-8 flex justify-center">
                <Link
                  href={filterUrl}
                  className='inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-[var(--hp-shadow-md)] hover:bg-brand-700 transition-colors'
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

          {/* ── Interlinking semántico ─────────────────────────────────────────
              Links crawlables hacia otras landing pages relacionadas.
              Crea grafo semántico entre hubs de categoría/precio/público. */}
          {relatedLinks && relatedLinks.length > 0 && (
            <div className="mt-10 pt-6 border-t border-[var(--hp-border)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--hp-text-muted)] mb-3">
                También te puede interesar
              </p>
              <div className="flex flex-wrap gap-2">
                {relatedLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] px-3 py-1.5 text-sm font-medium text-[var(--hp-text-primary)] shadow-sm transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
                  >
                    {link.emoji && <span aria-hidden>{link.emoji}</span>}
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
