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
  /**
   * 'desktop' → compacto inline en header
   * 'drawer'  → con label, full-width en menú móvil
   * 'hero'    → chip clickeable en el hero del home, abre el mismo modal
   */
  variant?: 'desktop' | 'drawer' | 'hero'
}

function formatCount(count?: number) {
  const n = count || 0
  if (n <= 0) return null
  return n.toLocaleString('es-CO')
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
    if (nextId) {
      localStorage.setItem(LS_KEY, nextId)
      // Guardar nombre para placeholder contextual en HeroSearch
      const name = cities.find(c => c.id === nextId)?.name
      if (name) localStorage.setItem('hp_city_name', name)
    } else {
      localStorage.removeItem(LS_KEY)
      localStorage.removeItem('hp_city_name') // Colombia → limpiar
    }
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
  // resolvedId='' → Toda Colombia (sin filtro ciudad)
  const resolvedId = (isAwarePage && urlCityId && cities.find(c => c.id === urlCityId))
    ? urlCityId
    : cities.find(c => c.id === cityId)?.id ?? ''

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

  // Iconos: declarados antes de los early returns para que SSR fallback pueda usarlos
  const PinIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className || "w-4 h-4"} aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )

  // SSR-safe (se evalúa después de todos los hooks para no romper la regla de React)
  // Hero: renderiza fallback estático antes del mount para evitar layout shift
  if (!mounted) {
    if (variant === 'hero') {
      return (
        <span className="inline-flex items-center gap-1.5 px-4 py-4 md:py-5 rounded-2xl border border-[var(--hp-border-subtle)] bg-[var(--hp-bg-elevated)] shadow-lg text-sm text-[var(--hp-text-muted)] shrink-0 whitespace-nowrap">
          <PinIcon className="w-3.5 h-3.5" />
          cerca de ti
        </span>
      )
    }
    return null
  }
  if (cities.length === 0) return null

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

    // Si elige la misma opción, solo cerramos
    if (nextId === resolvedId) {
      setIsOpen(false)
      return
    }

    trackEvent({ type: 'city_selected', metadata: { cityId: nextId || 'all', sourceCityId: resolvedId } })

    // 1. Persistir ('' limpia localStorage → próximo mount resolverá como Colombia)
    setCityId(nextId)

    // 2. Actualizar recientes (solo ciudades reales, no Colombia)
    if (nextId) {
      setRecentCityIds(prev => {
        const filtered = prev.filter(id => id !== nextId)
        return [nextId, ...filtered].slice(0, 5)
      })
    }

    // 3. Cerrar modal instantáneamente
    setIsOpen(false)

    // 4. Actualizar URL
    const isAware = CITY_AWARE_PATHS.some(p => pathname.startsWith(p))
    if (nextId === '') {
      // Toda Colombia: en página city-aware quitar cityId de URL; en home solo cerrar
      if (isAware) {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('cityId')
        const newSearch = params.toString()
        router.push(`${pathname}${newSearch ? `?${newSearch}` : ''}`)
      }
    } else if (isAware) {
      // Ya estamos en actividades/mapa → actualizar cityId en la URL actual
      const params = new URLSearchParams(searchParams.toString())
      params.set('cityId', nextId)
      router.push(`${pathname}?${params.toString()}`)
    } else {
      // Home u otra página → llevar directamente a actividades con la ciudad elegida
      router.push(`/actividades?cityId=${nextId}`)
    }
  }

  const CityRow = ({ city, isRecent = false }: { city: CityOption, isRecent?: boolean }) => {
    const isActive = city.id === resolvedId
    const countLabel = formatCount(city.activityCount)

    return (
      <button
        onClick={() => handleSelectCity(city.id, isRecent)}
        className={clsx(
          "w-full flex items-center justify-between gap-3 p-3.5 sm:p-3 rounded-xl transition-colors text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
          isActive ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-[var(--hp-bg-elevated)]"
        )}
      >
        {/* Izquierda: ícono + nombre (truncable) */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={clsx(
            "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
            isActive ? "bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400" : "bg-[var(--hp-bg-subtle)] text-[var(--hp-text-muted)] group-hover:bg-[var(--hp-bg-surface)]"
          )}>
            <PinIcon className="w-4 h-4" />
          </div>
          <span className={clsx(
            "font-medium text-[15px] truncate",
            isActive ? "text-brand-700 dark:text-brand-400" : "text-[var(--hp-text-primary)]"
          )}>
            {city.name}
          </span>
        </div>
        {/* Derecha: conteo — siempre reserva espacio, no se comprime */}
        {countLabel && (
          <span className={clsx(
            "shrink-0 tabular-nums text-sm",
            isActive ? "text-brand-600 dark:text-brand-400" : "text-[var(--hp-text-muted)]"
          )}>
            ({countLabel})
          </span>
        )}
      </button>
    )
  }

  const ChevronIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <path d="M19 9l-7 7-7-7" />
    </svg>
  )

  const GlobeIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className || "w-4 h-4"} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )

  return (
    <>
      {variant === 'hero' ? (
        <button
          onClick={handleOpenModal}
          aria-label={`Ciudad actual: ${currentCity?.name ?? 'Colombia'}. Cambiar ciudad`}
          className="inline-flex items-center gap-1.5 px-4 py-4 md:py-5 rounded-2xl border border-[var(--hp-border-subtle)] bg-[var(--hp-bg-elevated)] shadow-lg text-sm font-medium text-[var(--hp-text-primary)] hover:border-brand-400 hover:text-brand-600 transition-all cursor-pointer group shrink-0 whitespace-nowrap"
        >
          <PinIcon className="w-3.5 h-3.5 text-brand-500 shrink-0" />
          <span>{currentCity?.name ?? 'Colombia'}</span>
          <ChevronIcon />
        </button>
      ) : variant === 'drawer' ? (
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
              <span className="font-medium text-[var(--hp-text-primary)]">{currentCity?.name ?? 'Colombia'}</span>
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
          <span className="font-semibold text-[var(--hp-text-primary)]">{currentCity?.name ?? 'Colombia'}</span>
          {(currentCity?.activityCount ?? 0) > 0 && (
            <span className="tabular-nums text-xs text-[var(--hp-text-muted)] select-none hidden sm:inline">
              ({currentCity!.activityCount!.toLocaleString('es-CO')})
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

            {/* Toda Colombia */}
            <section>
              <button
                onClick={() => handleSelectCity('')}
                className={clsx(
                  "w-full flex items-center gap-3 p-3.5 sm:p-3 rounded-xl transition-colors text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                  resolvedId === '' ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-[var(--hp-bg-elevated)]"
                )}
              >
                <div className={clsx(
                  "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
                  resolvedId === '' ? "bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400" : "bg-[var(--hp-bg-subtle)] text-[var(--hp-text-muted)] group-hover:bg-[var(--hp-bg-surface)]"
                )}>
                  <GlobeIcon className="w-4 h-4" />
                </div>
                <span className={clsx(
                  "font-medium text-[15px]",
                  resolvedId === '' ? "text-brand-700 dark:text-brand-400" : "text-[var(--hp-text-primary)]"
                )}>
                  Toda Colombia
                </span>
              </button>
            </section>

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
