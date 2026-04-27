'use client'
// =============================================================================
// CityProvider — Estado global de ciudad (cliente)
// SSOT: URL (?cityId=xxx) > Context > localStorage (hp_city_id) > default
//
// Reglas de negocio:
//   - El Provider NO decide la ciudad. Solo sincroniza y expone.
//   - La URL es siempre canónica (permite compartir links y SSR correcto).
//   - cambiar ciudad → actualiza URL primero → datos se recargan.
//   - recargar página → mantiene ciudad (URL o localStorage).
// =============================================================================

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { resolveCityId } from '@/lib/city/resolveCity'

const LS_KEY = 'hp_city_id'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type CityOption = {
  id: string
  name: string
  defaultLat: number
  defaultLng: number
  defaultZoom: number
  /** Actividades ACTIVE en esta ciudad (opcional: solo viene del Header server query) */
  activityCount?: number
}

type CityContextValue = {
  cityId: string
  city: CityOption | undefined
  cities: CityOption[]
  setCityId: (id: string) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const CityContext = createContext<CityContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function CityProvider({
  children,
  defaultCityId,
  cities,
}: {
  children: React.ReactNode
  defaultCityId: string
  cities: CityOption[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const urlCityId = searchParams.get('cityId')
  const [cityId, setCityIdState] = useState<string>(defaultCityId)

  // ── Sync inicial: URL > localStorage > default (solo en mount) ──────────
  useEffect(() => {
    const stored =
      typeof window !== 'undefined'
        ? localStorage.getItem(LS_KEY)
        : null

    const resolved = resolveCityId({
      urlCityId,
      storedCityId: stored,
      defaultCityId,
    })

    setCityIdState(resolved)

    // Normalizar URL si falta cityId (replace: no agrega historial)
    if (!urlCityId && resolved) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('cityId', resolved)
      router.replace(`?${params.toString()}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Solo en mount

  // ── URL-watch: sincroniza estado cuando Filters navega via router.push ──
  // Cuando handleCity → navigate → router.push cambia la URL, useSearchParams
  // actualiza urlCityId → este efecto mantiene el estado interno (y por ende
  // localStorage) en sincronía sin acoplar Filters al Provider.
  useEffect(() => {
    if (!urlCityId) return
    setCityIdState(prev => (urlCityId !== prev ? urlCityId : prev))
  }, [urlCityId])

  // Persistencia en localStorage al cambiar
  useEffect(() => {
    if (!cityId) return
    localStorage.setItem(LS_KEY, cityId)
  }, [cityId])

  // Cambiar ciudad: URL primero (gatilla SSR/data reload), luego estado
  const setCityId = (nextId: string) => {
    if (nextId === cityId) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('cityId', nextId)
    router.push(`?${params.toString()}`)
    setCityIdState(nextId)
  }

  const city = useMemo(
    () => cities.find((c) => c.id === cityId),
    [cities, cityId]
  )

  const value = useMemo(
    () => ({ cityId, city, cities, setCityId }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cityId, city, cities]
  )

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCity(): CityContextValue {
  const ctx = useContext(CityContext)
  if (!ctx) throw new Error('useCity must be used within <CityProvider>')
  return ctx
}
