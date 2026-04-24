'use client'
// =============================================================================
// CitySwitcher — Selector de ciudad global en Header
//
// Standalone: no depende de CityProvider (que está scoped a /actividades y /mapa).
// Lee/escribe hp_city_id en localStorage directamente.
// Si el usuario está en /actividades o /mapa, actualiza ?cityId= en la URL.
// Solo se muestra cuando hay 2+ ciudades activas.
// =============================================================================

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { CityOption } from '@/components/providers/CityProvider'

const LS_KEY = 'hp_city_id'

// Páginas que reaccionan al cambio de ciudad via URL
const CITY_AWARE_PATHS = ['/actividades', '/mapa']

interface Props {
  cities: CityOption[]
  /** 'desktop' → compacto inline | 'drawer' → con label, full-width */
  variant?: 'desktop' | 'drawer'
}

export function CitySwitcher({ cities, variant = 'desktop' }: Props) {
  const [cityId, setCityId, mounted] = useLocalStorage<string>(LS_KEY, '')
  const pathname  = usePathname()
  const router    = useRouter()
  const searchParams = useSearchParams()

  // SSR-safe: esperar mount para evitar hydration mismatch
  if (!mounted || cities.length <= 1) return null

  const resolvedId = cities.find(c => c.id === cityId)?.id ?? cities[0]?.id ?? ''

  function handleChange(nextId: string) {
    if (nextId === resolvedId) return

    // 1. Persistir en localStorage
    setCityId(nextId)

    // 2. Si estamos en una página que reacciona a cityId → actualizar URL
    const isAwarePage = CITY_AWARE_PATHS.some(p => pathname.startsWith(p))
    if (isAwarePage) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('cityId', nextId)
      router.push(`${pathname}?${params.toString()}`)
    }
  }

  if (variant === 'drawer') {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--hp-text-muted)] mb-2">
          Tu ciudad
        </p>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--hp-bg-subtle)]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 shrink-0 text-[var(--hp-text-muted)]"
            aria-hidden="true"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <select
            value={resolvedId}
            onChange={e => handleChange(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[var(--hp-text-primary)] cursor-pointer focus:outline-none"
            aria-label="Seleccionar ciudad"
          >
            {cities.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
    )
  }

  // variant === 'desktop'
  return (
    <div className="flex items-center gap-1.5">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-3.5 h-3.5 shrink-0 text-[var(--hp-text-muted)]"
        aria-hidden="true"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <select
        value={resolvedId}
        onChange={e => handleChange(e.target.value)}
        className="text-sm text-[var(--hp-text-secondary)] bg-transparent border-none cursor-pointer focus:outline-none hover:text-[var(--hp-text-primary)] transition-colors"
        aria-label="Seleccionar ciudad"
      >
        {cities.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  )
}
