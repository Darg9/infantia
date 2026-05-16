// =============================================================================
// CategoryHub — Hub semántico de categorías para /actividades
//
// Propósito: Internal linking real hacia las landing pages semánticas.
// Aparece solo cuando no hay filtros activos (estado base de /actividades).
// Cada chip es un <Link> crawlable — no router.push, no botones, SSR puro.
//
// Orden de categorías: por volumen/CTR (no alfabético).
// "Gratis" separado visualmente — es intención de búsqueda, no categoría.
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

// Orden por volumen de contenido / CTR esperado.
// Taxonomía congelada hasta ~2026-07-01 — actualizar si cambian las 7 canónicas.
const SLUG_ORDER: Record<string, number> = {
  'musica':          1,
  'lectura':         2,
  'teatro-y-danza':  3,
  'arte-y-creatividad': 4,
  'deportes':        5,
  'ciencia-y-tec':   6,
  'naturaleza':      7,
  'manualidades':    8,
};

const CHIP_BASE =
  'inline-flex items-center gap-1.5 rounded-full border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] px-3 py-1.5 text-sm font-medium text-[var(--hp-text-primary)] shadow-sm transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600';

export function CategoryHub({ categories, freeCount }: CategoryHubProps) {
  if (categories.length === 0) return null;

  // Ordenar por prioridad SEO/CTR; categorías sin orden explícito van al final
  const sorted = [...categories].sort(
    (a, b) => (SLUG_ORDER[a.slug] ?? 99) - (SLUG_ORDER[b.slug] ?? 99),
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ── Categorías ── */}
      <section aria-label="Actividades por categoría" className="flex flex-col gap-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--hp-text-muted)]">
          Actividades por categoría
        </h2>
        <div className="flex flex-wrap gap-2">
          {sorted.map((cat) => (
            <Link
              key={cat.slug}
              href={`/actividades/categoria/${cat.slug}`}
              className={CHIP_BASE}
            >
              <span aria-hidden>{getCategoryEmoji(cat.name)}</span>
              <span>{cat.name}</span>
              <span className="text-xs text-[var(--hp-text-muted)]">({cat._count.activities})</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Precio — intención de búsqueda separada de las categorías ── */}
      {freeCount > 0 && (
        <section aria-label="Filtrar por precio" className="flex flex-col gap-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--hp-text-muted)]">
            Por precio
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/actividades/precio/gratis"
              className="inline-flex items-center gap-1.5 rounded-full border border-success-200 bg-success-50 px-3 py-1.5 text-sm font-medium text-success-700 shadow-sm transition-colors hover:border-success-400 hover:bg-success-100"
            >
              <span aria-hidden>✨</span>
              <span>Gratis</span>
              <span className="text-xs text-success-600">({freeCount})</span>
            </Link>
            <Link
              href="/actividades/precio/pagas"
              className={CHIP_BASE}
            >
              <span aria-hidden>💳</span>
              <span>De pago</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
