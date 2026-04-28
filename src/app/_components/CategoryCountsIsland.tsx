'use client'
// =============================================================================
// CategoryCountsIsland — Conteos de categorías ajustados a la ciudad del usuario
//
// Patrón "hydration island" (igual que CityHeroLabel):
//   - Servidor → renderiza conteos globales (sin ciudad, calidad-filtrados)
//   - Cliente  → tras mount, lee hp_city_id de localStorage, hace UN fetch al
//               API y reemplaza los números silenciosamente.
//
// Sin layout shift: los números se intercambian en el mismo espacio.
// Sin skeleton/loading: se parte del conteo global y se actualiza in-place.
// =============================================================================

import { useEffect, useState } from 'react'

const LS_KEY = 'hp_city_id'

interface Props {
  /** IDs de las categorías a mostrar (estáticos desde el servidor) */
  categoryIds: string[]
  /** Conteos globales del servidor — usados como fallback y estado inicial */
  fallbackCounts: Record<string, number>
  /** Render prop: recibe los conteos actuales (globales o city-específicos) */
  children: (counts: Record<string, number>) => React.ReactNode
}

export function CategoryCountsIsland({ categoryIds, fallbackCounts, children }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>(fallbackCounts)

  useEffect(() => {
    if (!categoryIds.length) return

    const cityId = localStorage.getItem(LS_KEY)
    if (!cityId) return // sin ciudad guardada → mantener conteos globales del servidor

    const url = new URL('/api/activities/category-counts', window.location.origin)
    url.searchParams.set('cityId', cityId)
    categoryIds.forEach((id) => url.searchParams.append('ids', id))

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
  // categoryIds es estático para el ciclo de vida de la página
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{children(counts)}</>
}
