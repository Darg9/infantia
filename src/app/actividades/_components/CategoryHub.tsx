// =============================================================================
// CategoryHub — Hub semántico de categorías para /actividades
//
// Propósito: Internal linking real hacia las landing pages semánticas.
// Aparece solo cuando no hay filtros activos (estado base de /actividades).
// Cada chip es un <Link> crawlable — no router.push, no botones.
// =============================================================================

import Link from 'next/link';
import { getCategoryEmoji } from '@/lib/category-utils';

export interface HubCategory {
  id: string;
  name: string;
  slug: string;
  _count: { activities: number };
}

interface CategoryHubProps {
  categories: HubCategory[];
  freeCount: number;
}

export function CategoryHub({ categories, freeCount }: CategoryHubProps) {
  if (categories.length === 0) return null;

  return (
    <section aria-label="Explorar por tipo de actividad" className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--hp-text-muted)]">
        Explorar por tipo
      </h2>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/actividades/categoria/${cat.slug}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] px-3 py-1.5 text-sm font-medium text-[var(--hp-text-primary)] shadow-sm transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
          >
            <span aria-hidden>{getCategoryEmoji(cat.name)}</span>
            <span>{cat.name}</span>
            <span className="text-xs text-[var(--hp-text-muted)]">({cat._count.activities})</span>
          </Link>
        ))}

        {freeCount > 0 && (
          <Link
            href="/actividades/precio/gratis"
            className="inline-flex items-center gap-1.5 rounded-full border border-success-200 bg-success-50 px-3 py-1.5 text-sm font-medium text-success-700 shadow-sm transition-colors hover:border-success-400 hover:bg-success-100"
          >
            <span aria-hidden>✨</span>
            <span>Gratis</span>
            <span className="text-xs text-success-600">({freeCount})</span>
          </Link>
        )}
      </div>
    </section>
  );
}
