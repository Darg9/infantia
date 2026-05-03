'use client'
// =============================================================================
// CategoryCountsIsland — Conteos de categorías ajustados a la ciudad del usuario
//
// Patrón "hydration island" (igual que CityHeroLabel):
//   - Servidor → pasa datos de categorías + conteos globales (calidad-filtrados)
//   - Cliente  → tras mount, lee hp_city_id de localStorage, hace UN fetch al
//               API y reemplaza los números silenciosamente.
//
// Sin layout shift: los números se intercambian en el mismo espacio.
// Sin skeleton/loading: se parte del conteo global y se actualiza in-place.
// Sin render prop: acepta datos serializables (no funciones) — requisito RSC.
// =============================================================================

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getCategoryEmoji, getCategoryGradient } from '@/lib/category-utils'

const LS_KEY = 'hp_city_id'

export interface CategoryItem {
  id: string
  name: string
  slug: string
  initialCount: number
}

interface Props {
  categories: CategoryItem[]
}

export function CategoryCountsIsland({ categories }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(categories.map((c) => [c.id, c.initialCount])),
  )

  useEffect(() => {
    if (!categories.length) return

    const cityId = localStorage.getItem(LS_KEY)
    if (!cityId) return // sin ciudad guardada → mantener conteos globales del servidor

    const url = new URL('/api/activities/category-counts', window.location.origin)
    url.searchParams.set('cityId', cityId)
    categories.forEach(({ id }) => url.searchParams.append('ids', id))

    let cancelled = false

    fetch(url.toString())
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Record<string, number> | null) => {
        if (!cancelled && data) setCounts(data)
      })
      .catch(() => {
        // Falla silenciosa — el usuario sigue viendo los conteos globales del servidor
      })

    return () => {
      cancelled = true
    }
  // categories es estático para el ciclo de vida de la página
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {categories.map((cat, index) => {
        const count = counts[cat.id] ?? cat.initialCount
        // Ocultar a partir de la 5ta categoría solo en Desktop para mantener 1 sola fila visible
        const desktopHiddenClass = index >= 4 ? 'sm:hidden' : ''
        return (
          <Link
            key={cat.id}
            href={`/actividades?categoryId=${cat.id}`}
            className={`group flex flex-col items-center gap-2.5 rounded-2xl bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] p-5 text-center hover:border-brand-300 hover:shadow-[var(--hp-shadow-[var(--hp-shadow-md)])] transition-all ${desktopHiddenClass}`}
          >
            {/* Ícono con gradiente de la categoría */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ background: getCategoryGradient(cat.slug) }}
            >
              {getCategoryEmoji(cat.name)}
            </div>
            <span className="text-sm font-semibold text-[var(--hp-text-primary)] group-hover:text-hp-action-primary transition-colors leading-tight">
              {cat.name}
            </span>
            <span className="text-xs text-[var(--hp-text-muted)] tabular-nums">
              {/* key={count}: React remonta este span al cambiar → animación fade */}
              <span key={count} className="hp-count-fade">{count}</span>
              {' '}{count === 1 ? 'actividad' : 'actividades'}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
