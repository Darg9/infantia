// =============================================================================
// Pagination — controles de paginación para /actividades
// Usa <a> nativas en lugar de router.push para evitar desfase entre el
// estado del cliente y lo que el Server Component recibe como searchParams.
// =============================================================================

'use client';

import { usePathname, useSearchParams } from 'next/navigation';

interface PaginationProps {
  page: number;
  totalPages: number;
}

export default function Pagination({ page, totalPages }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function hrefFor(newPage: number): string {
    const sp = new URLSearchParams(searchParams.toString());
    if (newPage === 1) {
      sp.delete('page');
    } else {
      sp.set('page', String(newPage));
    }
    const qs = sp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  // Genera array de páginas a mostrar (máx 7 números)
  function getPages(): (number | '…')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '…')[] = [1];
    if (page > 3) pages.push('…');
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) {
      pages.push(p);
    }
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
    return pages;
  }

  const anchorCls = 'rounded-lg border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] px-3 py-1.5 text-sm text-gray-600 hover:bg-[var(--hp-bg-page)] transition-colors';
  const disabledCls = 'rounded-lg border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] px-3 py-1.5 text-sm text-gray-600 opacity-40 cursor-not-allowed pointer-events-none';

  return (
    <nav aria-label="Paginación" className="flex items-center justify-center gap-1">
      {page === 1 ? (
        <span className={disabledCls}>← Anterior</span>
      ) : (
        <a href={hrefFor(page - 1)} className={anchorCls}>← Anterior</a>
      )}

      {getPages().map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-[var(--hp-text-muted)] text-sm" aria-hidden>…</span>
        ) : (
          <a
            key={p}
            href={hrefFor(p as number)}
            aria-current={p === page ? 'page' : undefined}
            className={
              p === page
                ? 'rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white pointer-events-none'
                : anchorCls
            }
          >
            {p}
          </a>
        )
      )}

      {page >= totalPages ? (
        <span className={disabledCls}>Siguiente →</span>
      ) : (
        <a href={hrefFor(page + 1)} className={anchorCls}>Siguiente →</a>
      )}
    </nav>
  );
}
