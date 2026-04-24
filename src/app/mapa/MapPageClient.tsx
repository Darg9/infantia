'use client'

// =============================================================================
// MapPageClient — UI del mapa (cliente)
// Consume CityProvider para selector + datos dinámicos.
// =============================================================================

import dynamic from 'next/dynamic'
import type { MapPoint } from '@/components/ActivityMap'
import { useCity } from '@/components/providers/CityProvider'
import type { CityOption } from '@/components/providers/CityProvider'

const ActivityMap = dynamic(() => import('@/components/ActivityMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[var(--hp-bg-page)] rounded-2xl" style={{ height: '580px' }}>
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-[var(--hp-text-secondary)]">Cargando mapa…</p>
      </div>
    </div>
  ),
})

interface Props {
  points: MapPoint[]
  activeCity: CityOption | undefined
  totalCount: number
}

export default function MapPageClient({ points, activeCity, totalCount }: Props) {
  const { cityId, city, cities, setCityId } = useCity()

  // La ciudad activa en cliente puede diferir del SSR si hay cambio via selector
  // En ese caso, los datos se recargaran con la nueva URL (router.push en CityProvider)
  const defaultCenter = city
    ? { lat: city.defaultLat, lng: city.defaultLng, zoom: city.defaultZoom }
    : activeCity
    ? { lat: activeCity.defaultLat, lng: activeCity.defaultLng, zoom: activeCity.defaultZoom }
    : undefined

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="bg-[var(--hp-bg-surface)] border-b border-[var(--hp-border)] px-4 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-[var(--hp-text-primary)]">
              Mapa de actividades
            </h1>
            <p className="text-sm text-[var(--hp-text-secondary)] mt-0.5">
              {totalCount} {totalCount === 1 ? 'actividad' : 'actividades'}
              {city ? ` en ${city.name}` : activeCity ? ` en ${activeCity.name}` : ''}
              {' '}· Haz clic en un pin para ver detalles
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Selector de ciudad */}
            <select
              id="city-selector"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="text-sm border border-[var(--hp-border)] rounded-lg px-3 py-1.5 bg-[var(--hp-bg-surface)] text-[var(--hp-text-primary)] cursor-pointer"
              aria-label="Seleccionar ciudad"
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <a
              href="/actividades"
              className="shrink-0 text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              ← Ver listado
            </a>
          </div>
        </div>
      </div>

      {/* Mapa */}
      <div className="p-4 flex-1">
        <div className="mx-auto max-w-7xl" style={{ height: '580px' }}>
          <ActivityMap points={points} defaultCenter={defaultCenter} />
        </div>
      </div>

      {/* Nota coordenadas */}
      <p className="text-center text-xs text-[var(--hp-text-muted)] pb-3 px-4">
        Solo se muestran actividades con ubicación verificada. Las demás están disponibles en el listado.
      </p>
    </div>
  )
}
