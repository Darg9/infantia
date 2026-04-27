'use client'
// =============================================================================
// CityHeroLabel — Isla cliente para la ciudad contextual en el hero
//
// Patrón "hydration island":
//   - Servidor → renderiza "cerca de ti" (estado inicial null)
//   - Cliente  → tras mount, lee hp_city_id de localStorage y sustituye el
//               texto por "en Bogotá" (o la ciudad almacenada)
//
// No hay mismatch de hidratación: ambos lados parten de cityName=null.
// El min-w reserva ancho para que el reflow post-hydration sea invisible.
// =============================================================================

import { useEffect, useState } from 'react'

const LS_KEY = 'hp_city_id'

interface CityStub {
  id: string
  name: string
}

interface Props {
  cities: CityStub[]
}

export function CityHeroLabel({ cities }: Props) {
  const [cityName, setCityName] = useState<string | null>(null)

  useEffect(() => {
    const storedId = localStorage.getItem(LS_KEY)
    if (!storedId) return
    const match = cities.find((c) => c.id === storedId)
    if (match) setCityName(match.name)
  }, [cities])

  return (
    <p className="text-lg text-[var(--hp-text-secondary)]">
      Descubre planes en familia{' '}
      <span className="inline-block min-w-[88px] text-left transition-opacity duration-300">
        {cityName ? (
          <>
            en{' '}
            <span className="font-semibold text-[var(--hp-text-primary)]">
              {cityName}
            </span>
          </>
        ) : (
          'cerca de ti'
        )}
      </span>
    </p>
  )
}
