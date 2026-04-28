'use client'
// =============================================================================
// CitySwitcher — Selector de ciudad global en Header con Modal interactivo
//
// Standalone: no depende de CityProvider.
// Lee/escribe hp_city_id y hp_recent_cities en localStorage.
// =============================================================================

import { useEffect, useState, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { Modal } from '@/components/ui'
import { trackEvent } from '@/lib/track'
import type { CityOption } from '@/components/providers/CityProvider'

const LS_KEY = 'hp_city_id'
const LS_RECENT_KEY = 'hp_recent_cities'
const CITY_AWARE_PATHS = ['/actividades', '/mapa']

interface Props {
  cities: CityOption[]
  /** 'desktop' → compacto inline | 'drawer' → con label, full-width */
  variant?: 'desktop' | 'drawer'
}

function formatCount(count?: number) {
  const n = count || 0
  if (n >= 20) return `${n.toLocaleString('es-CO')}`
  if (n >= 5) return 'Nuevos planes'
  if (n >= 1) return 'Disponible'
  return null
}

export function CitySwitcher({ cities, variant = 'desktop' }: Props) {
  // hp_city_id es un string plano (UUID). Usamos raw localStorage para que
  // CityProvider, CategoryCountsIsland y CityHeroLabel lean el mismo valor sin
  // tener que JSON.parse. useLocalStorage JSON.stringify-a los valores, lo que
  // corrompe el UUID al almacenarlo como "\"uuid\"" → lecturas directas reciben
  // comillas literales y backslashes → cityId inválido en URL.
  const [mounted, setMounted] = useState(false)
  const [cityId, setCityIdRaw] = useState('')

  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      // Compatibilidad hacia atrás: si el valor está JSON-encodificado (con comillas),
      // limpiarlo. Ejemplo: '"uuid-123"' → 'uuid-123'
      try {
        const parsed = JSON.parse(raw)
        if (typeof parsed === 'string') {
          setCityIdRaw(parsed)
          localStorage.setItem(LS_KEY, parsed) // normalizar a raw
        } else {
          setCityIdRaw(raw)
        }
      } catch {
        setCityIdRaw(raw) // ya es raw, usar directo
      }
    }
    setMounted(true)
  }, [])

  function setCityId(nextId: string) {
    setCityIdRaw(nextId)
    localStorage.setItem(LS_KEY, nextId) // raw — sin JSON.stringify
  }

  const [recentCityIds, setRecentCityIds] = useLocalStorage<string[]>(LS_RECENT_KEY, [])
  const [isOpen, setIsOpen] = useState(false)
  
  const pathname  = usePathname()
  const router    = useRouter()
  const searchParams = useSearchParams()
  const urlCityId = searchParams.get('cityId')

  // Sincronizar localStorage con la URL en páginas city-aware
  useEffect(() => {
    if (!mounted) return
    const isAwarePage = CITY_AWARE_PATHS.some(p => pathname.startsWith(p))
    if (isAwarePage && urlCityId && urlCityId !== cityId) {
      setCityId(urlCityId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, urlCityId, pathname])



  // Prioridad de resolución SSOT
  const isAwarePage = CITY_AWARE_PATHS.some(p => pathname.startsWith(p))
  const resolvedId = (isAwarePage && urlCityId && cities.find(c => c.id === urlCityId))
    ? urlCityId
    : cities.find(c => c.id === cityId)?.id ?? cities[0]?.id ?? ''

  const currentCity = cities.find(c => c.id === resolvedId)

  // Lógica de Ranking Híbrido
  const groupedCities = useMemo(() => {
    const actualId = resolvedId
    const current = cities.find(c => c.id === actualId) || null
    
    // Recientes (max 3, excluyendo actual)
    const recientes = recentCityIds
      .filter(id => id !== actualId)
      .map(id => cities.find(c => c.id === id))
      .filter((c): c is CityOption => !!c)
      .slice(0, 3)
    
    const recientesIds = new Set(recientes.map(c => c.id))
    
    // Más activas (Top Tier)
    const fuertes = cities
      .filter(c => c.id !== actualId && !recientesIds.has(c.id) && (c.activityCount || 0) >= 20)
      .sort((a, b) => (b.activityCount || 0) - (a.activityCount || 0))
      .slice(0, 3)

    const fuertesIds = new Set(fuertes.map(c => c.id))
    
    // Restantes alfabético
    const restantes = cities
      .filter(c => c.id !== actualId && !recientesIds.has(c.id) && !fuertesIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name))

    return { current, recientes, fuertes, restantes }
  }, [cities, resolvedId, recentCityIds])

  // SSR-safe (se evalúa después de todos los hooks para no romper la regla de React)
  if (!mounted || cities.length <= 1) return null

  function handleOpenModal() {
    setIsOpen(true)
    trackEvent({ type: 'city_modal_open', metadata: { sourceCityId: resolvedId } })
  }

  function handleCloseModal() {
    setIsOpen(false)
    trackEvent({ type: 'city_modal_close_no_select', metadata: { sourceCityId: resolvedId } })
  }

  function handleSelectCity(nextId: string, isRecentClick = false) {
    if (isRecentClick) {
      trackEvent({ type: 'city_recent_selected', metadata: { cityId: nextId, sourceCityId: resolvedId } })
    }
    
    // Si elige la misma ciudad, solo cerramos
    if (nextId === resolvedId) {
      setIsOpen(false)
      return
    }

    trackEvent({ type: 'city_selected', metadata: { cityId: nextId, sourceCityId: resolvedId } })

    // 1. Persistir
    setCityId(nextId)
    
    // 2. Actualizar recientes (poner al inicio, unique, max 5 en storage real)
    setRecentCityIds(prev => {
      const filtered = prev.filter(id => id !== nextId)
      return [nextId, ...filtered].slice(0, 5)
    })
    
    // 3. Cerrar modal instantáneamente
    setIsOpen(false)

    // 4. Actualizar URL si corresponde
    if (CITY_AWARE_PATHS.some(p => pathname.startsWith(p))) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('cityId', nextId)
      router.push(`${pathname}?${params.toString()}`)
    }
  }

  const PinIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className || "w-4 h-4"} aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )

  const CityRow = ({ city, isRecent = false }: { city: CityOption, isRecent?: boolean }) => {
    const isActive = city.id === resolvedId
    const countLabel = formatCount(city.activityCount)
    // Determinar si el label es solo texto o un numero con badge
    const isNumber = (city.activityCount || 0) >= 20

    return (
      <button
        onClick={() => handleSelectCity(city.id, isRecent)}
        className={clsx(
          "w-full flex items-center justify-between p-3.5 sm:p-3 rounded-xl transition-colors text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
          isActive ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-[var(--hp-bg-elevated)]"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={clsx(
            "flex items-center justify-center w-8 h-8 rounded-full",
            isActive ? "bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400" : "bg-[var(--hp-bg-subtle)] text-[var(--hp-text-muted)] group-hover:bg-[var(--hp-bg-surface)]"
          )}>
            <PinIcon className="w-4 h-4" />
          </div>
          <span className={clsx(
            "font-medium text-[15px]",
            isActive ? "text-brand-700 dark:text-brand-400" : "text-[var(--hp-text-primary)]"
          )}>
            {city.name}
          </span>
        </div>
        {countLabel && (
          <span className={clsx(
            "text-sm",
            isActive ? "text-brand-600 dark:text-brand-400" : "text-[var(--hp-text-muted)]",
            isNumber ? "" : "italic"
          )}>
            {isNumber && <span className="mr-1 hidden sm:inline">·</span>}
            {countLabel}
          </span>
        )}
      </button>
    )
  }

  return (
    <>
      {variant === 'drawer' ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--hp-text-muted)] mb-2">
            Tu ciudad
          </p>
          <button
            onClick={handleOpenModal}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--hp-bg-subtle)] text-sm text-[var(--hp-text-primary)] cursor-pointer focus:outline-none hover:bg-[var(--hp-bg-elevated)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <PinIcon className="w-4 h-4 text-[var(--hp-text-muted)]" />
              <span className="font-medium text-[var(--hp-text-primary)]">{currentCity?.name}</span>
            </div>
            <span className="text-[var(--hp-text-muted)] font-medium text-xs">Cambiar</span>
          </button>
        </div>
      ) : (
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-1.5 text-sm text-[var(--hp-text-secondary)] bg-transparent border-none cursor-pointer focus:outline-none hover:text-[var(--hp-text-primary)] transition-colors group"
          aria-label="Seleccionar ciudad"
        >
          <PinIcon className="w-3.5 h-3.5 text-[var(--hp-text-muted)] group-hover:text-brand-500 transition-colors" />
          <span className="font-semibold text-[var(--hp-text-primary)]">{currentCity?.name}</span>
          {currentCity?.activityCount != null && currentCity.activityCount >= 20 && (
            <span className="text-xs text-[var(--hp-text-muted)] select-none hidden sm:inline">
              · {currentCity.activityCount.toLocaleString('es-CO')}
            </span>
          )}
        </button>
      )}

      <Modal 
        open={isOpen} 
        onClose={handleCloseModal} 
        title="Elige ciudad"
        description="Encuentra actividades cerca de ti"
        mobilePosition="bottom"
      >
        <Modal.Body className="px-4 sm:px-6 pb-6">
          <div className="space-y-6">
            
            {/* Ciudad Actual */}
            {groupedCities.current && (
              <section>
                <div className="mb-2 px-1">
                  <CityRow city={groupedCities.current} />
                </div>
              </section>
            )}

            {/* Recientes */}
            {groupedCities.recientes.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--hp-text-muted)] mb-2 px-3">
                  Recientes
                </h3>
                <div className="space-y-0.5">
                  {groupedCities.recientes.map(c => (
                    <CityRow key={c.id} city={c} isRecent />
                  ))}
                </div>
              </section>
            )}

            {/* Más activas */}
            {groupedCities.fuertes.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--hp-text-muted)] mb-2 px-3">
                  Más activas
                </h3>
                <div className="space-y-0.5">
                  {groupedCities.fuertes.map(c => (
                    <CityRow key={c.id} city={c} />
                  ))}
                </div>
              </section>
            )}

            {/* Resto */}
            {groupedCities.restantes.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--hp-text-muted)] mb-2 px-3">
                  Todas
                </h3>
                <div className="space-y-0.5">
                  {groupedCities.restantes.map(c => (
                    <CityRow key={c.id} city={c} />
                  ))}
                </div>
              </section>
            )}

          </div>
        </Modal.Body>
      </Modal>
    </>
  )
}
