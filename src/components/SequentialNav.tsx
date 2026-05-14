'use client'

// =============================================================================
// SequentialNav — Navegación editorial prev/next entre actividades.
//
// V2: Reemplaza labels genéricos por previews contextuales con título truncado.
//     Diseño floating centrado (max-w-2xl) para sensación discovery, no toolbar.
//
// Lee el contexto almacenado en sessionStorage por ActivityListTracker cuando
// el usuario viene del listado /actividades. Si no hay contexto, o la actividad
// actual no está en la lista, el componente no renderiza nada.
//
// Una sola instancia (inline, bajo el breadcrumb) en todos los breakpoints.
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
    if (Date.now() - parsed.storedAt > NAV_TTL) {
      sessionStorage.removeItem(NAV_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

// Flecha izquierda
function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Flecha derecha
function ChevronRight({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SequentialNav({ activityId }: Props) {
  const [ctx] = useState<NavContext | null>(readNavContext)

  if (!ctx) return null

  const currentIndex = ctx.items.findIndex((item) => item.id === activityId)
  if (currentIndex === -1) return null

  const prevItem = currentIndex > 0 ? ctx.items[currentIndex - 1] : null
  const nextItem = currentIndex < ctx.items.length - 1 ? ctx.items[currentIndex + 1] : null

  if (!prevItem && !nextItem) return null

  const position = `${currentIndex + 1} / ${ctx.items.length}`

  return (
    <div className="mx-auto max-w-4xl px-4 mt-4">
      {/* Floating card centrada — max-w-2xl crea separación visual del contenido full-width */}
      <nav
        className="mx-auto max-w-2xl rounded-2xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] shadow-sm"
        aria-label="Navegación entre actividades"
      >
        <div className="flex items-center px-5 py-3 gap-3">

          {/* ── Anterior ────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {prevItem ? (
              <Link
                href={activityPath(prevItem.id, prevItem.title)}
                className="group flex items-center gap-1.5 text-[var(--hp-text-secondary)] hover:text-brand-600 transition-colors"
                aria-label={`Anterior: ${prevItem.title}`}
              >
                <ChevronLeft className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                {/* sm+: título truncado | <sm: label corto para no colapsar el layout */}
                <span className="hidden sm:block truncate text-sm font-medium leading-snug">
                  {prevItem.title}
                </span>
                <span className="sm:hidden text-sm font-medium whitespace-nowrap">Anterior</span>
              </Link>
            ) : (
              <span className="invisible select-none text-sm" aria-hidden="true">—</span>
            )}
          </div>

          {/* ── Contador ────────────────────────────────────────────────── */}
          <span className="shrink-0 text-xs text-[var(--hp-text-muted)] tabular-nums px-3 border-x border-[var(--hp-border)] leading-none py-0.5">
            {position}
          </span>

          {/* ── Siguiente ───────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 overflow-hidden flex justify-end">
            {nextItem ? (
              <Link
                href={activityPath(nextItem.id, nextItem.title)}
                className="group flex items-center gap-1.5 text-[var(--hp-text-secondary)] hover:text-brand-600 transition-colors min-w-0 max-w-full"
                aria-label={`Siguiente: ${nextItem.title}`}
              >
                <span className="hidden sm:block truncate text-sm font-medium leading-snug">
                  {nextItem.title}
                </span>
                <span className="sm:hidden text-sm font-medium whitespace-nowrap">Siguiente</span>
                <ChevronRight className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
              </Link>
            ) : (
              <span className="invisible select-none text-sm" aria-hidden="true">—</span>
            )}
          </div>

        </div>
      </nav>
    </div>
  )
}
