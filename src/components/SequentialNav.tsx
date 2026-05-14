'use client'

// =============================================================================
// SequentialNav — Navegación anterior/siguiente entre actividades.
//
// Lee el contexto almacenado en sessionStorage por ActivityListTracker cuando
// el usuario viene del listado /actividades. Si no hay contexto, o la actividad
// actual no está en la lista, el componente no renderiza nada.
//
// Desktop (xl+): flechas laterales fijas, fuera del contenedor max-w-4xl.
// Mobile: barra compacta inline debajo del breadcrumb.
// =============================================================================

import Link from 'next/link'
import { useState } from 'react'
import { activityPath } from '@/lib/activity-url'

const NAV_KEY = 'hp_nav_ctx'
const NAV_TTL = 30 * 60 * 1000 // 30 min

interface NavItem {
  id: string
  title: string
}

interface NavContext {
  items: NavItem[]
  returnUrl: string
  storedAt: number
}

interface Props {
  activityId: string
}

function readNavContext(): NavContext | null {
  try {
    const raw = sessionStorage.getItem(NAV_KEY)
    if (!raw) return null
    const parsed: NavContext = JSON.parse(raw)
    // TTL check — si expiró, limpiar y no mostrar
    if (Date.now() - parsed.storedAt > NAV_TTL) {
      sessionStorage.removeItem(NAV_KEY)
      return null
    }
    return parsed
  } catch {
    // JSON inválido u otro error de storage — silenciar
    return null
  }
}

export function SequentialNav({ activityId }: Props) {
  const [ctx] = useState<NavContext | null>(readNavContext)

  if (!ctx) return null

  const currentIndex = ctx.items.findIndex((item) => item.id === activityId)
  if (currentIndex === -1) return null

  const prevItem = currentIndex > 0 ? ctx.items[currentIndex - 1] : null
  const nextItem = currentIndex < ctx.items.length - 1 ? ctx.items[currentIndex + 1] : null

  // Si está sola (primera y última), no hay nada que mostrar
  if (!prevItem && !nextItem) return null

  const position = `${currentIndex + 1} / ${ctx.items.length}`

  // Posición de las flechas desktop:
  // max-w-4xl = 896px → mitad = 448px.
  // Las flechas (w-11 = 44px) se colocan a calc(50% - 448px - 60px) del borde,
  // lo que las deja justo fuera del contenedor. max(12px, ...) como safety margin.
  const leftStyle: React.CSSProperties = { left: 'max(12px, calc(50% - 508px))' }
  const rightStyle: React.CSSProperties = { right: 'max(12px, calc(50% - 508px))' }

  const arrowBase =
    'pointer-events-auto fixed top-1/2 -translate-y-1/2 z-40 flex items-center justify-center w-11 h-11 rounded-full bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] shadow-md text-[var(--hp-text-secondary)] hover:text-brand-600 hover:border-brand-300 transition-all'

  return (
    <>
      {/* ── Desktop: flechas laterales fijas ─────────────────────────────── */}
      {/* pointer-events-none en el wrapper para que no bloquee clics en el contenido */}
      <div className="hidden xl:block pointer-events-none" aria-hidden="true">
        {prevItem && (
          <Link
            href={activityPath(prevItem.id, prevItem.title)}
            className={arrowBase}
            style={leftStyle}
            aria-label={`Anterior: ${prevItem.title}`}
            title={prevItem.title}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
        {nextItem && (
          <Link
            href={activityPath(nextItem.id, nextItem.title)}
            className={arrowBase}
            style={rightStyle}
            aria-label={`Siguiente: ${nextItem.title}`}
            title={nextItem.title}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
      </div>

      {/* ── Mobile: barra inline debajo del breadcrumb ───────────────────── */}
      <nav
        className="xl:hidden mx-auto max-w-4xl px-4 mt-2"
        aria-label="Navegación entre actividades"
      >
        <div className="flex items-center justify-between rounded-xl bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] px-3 py-2 text-sm">
          {prevItem ? (
            <Link
              href={activityPath(prevItem.id, prevItem.title)}
              className="flex items-center gap-1 text-[var(--hp-text-secondary)] hover:text-brand-600 font-medium transition-colors"
              aria-label={`Anterior: ${prevItem.title}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Anterior
            </Link>
          ) : (
            <span className="invisible select-none text-sm" aria-hidden="true">Anterior</span>
          )}

          <span className="text-xs text-[var(--hp-text-muted)] tabular-nums">{position}</span>

          {nextItem ? (
            <Link
              href={activityPath(nextItem.id, nextItem.title)}
              className="flex items-center gap-1 text-[var(--hp-text-secondary)] hover:text-brand-600 font-medium transition-colors"
              aria-label={`Siguiente: ${nextItem.title}`}
            >
              Siguiente
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ) : (
            <span className="invisible select-none text-sm" aria-hidden="true">Siguiente</span>
          )}
        </div>
      </nav>
    </>
  )
}
