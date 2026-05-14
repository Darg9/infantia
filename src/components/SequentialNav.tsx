'use client'

// =============================================================================
// SequentialNav — Navegación editorial prev/next entre actividades.
//
// V3: Jerarquía visual refinada.
//   - Títulos: protagonistas (text-primary, font-medium, hover brand-600)
//   - Flechas: secundarias (opacity-40 → 100% on hover)
//   - Contador: metadata recesiva (text-[11px], opacity-60, sin border)
//
// Una sola instancia inline bajo el breadcrumb. Mobile compacto (sm).
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

function ChevronLeft() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
      <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
      <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
      <nav
        className="mx-auto max-w-2xl rounded-2xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] shadow-sm"
        aria-label="Navegación entre actividades"
      >
        <div className="flex items-center px-6 py-3.5">

          {/* ── Anterior ─────────────────────────────────────────────────
              flex-1 + min-w-0 + overflow-hidden: el título se trunca sin
              romper el layout. Hit area ampliada con py-1 en el link.     */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {prevItem ? (
              <Link
                href={activityPath(prevItem.id, prevItem.title)}
                className="group flex items-center gap-1.5 text-[var(--hp-text-primary)] hover:text-brand-600 transition-colors duration-150 py-1 -my-1"
                aria-label={`Anterior: ${prevItem.title}`}
              >
                <ChevronLeft />
                {/* sm+: título truncado con ellipsis | <sm: label corto */}
                <span className="hidden sm:block truncate text-sm font-medium leading-snug">
                  {prevItem.title}
                </span>
                <span className="sm:hidden text-sm font-medium whitespace-nowrap">Anterior</span>
              </Link>
            ) : (
              <span className="invisible select-none text-sm" aria-hidden="true">—</span>
            )}
          </div>

          {/* ── Contador ─────────────────────────────────────────────────
              Metadata secundaria: muy recesiva para que los títulos
              sean los protagonistas visuales. Sin border — el padding
              horizontal (px-5) crea la separación sin estructura visual. */}
          <span
            className="shrink-0 text-[11px] tabular-nums select-none opacity-60 text-[var(--hp-text-muted)] px-5"
            aria-label={`Actividad ${currentIndex + 1} de ${ctx.items.length}`}
          >
            {position}
          </span>

          {/* ── Siguiente ────────────────────────────────────────────────
              justify-end empuja el link a la derecha. min-w-0 + max-w-full
              en el link permite que truncate funcione correctamente.       */}
          <div className="flex-1 min-w-0 overflow-hidden flex justify-end">
            {nextItem ? (
              <Link
                href={activityPath(nextItem.id, nextItem.title)}
                className="group flex items-center gap-1.5 text-[var(--hp-text-primary)] hover:text-brand-600 transition-colors duration-150 min-w-0 max-w-full py-1 -my-1"
                aria-label={`Siguiente: ${nextItem.title}`}
              >
                <span className="hidden sm:block truncate text-sm font-medium leading-snug">
                  {nextItem.title}
                </span>
                <span className="sm:hidden text-sm font-medium whitespace-nowrap">Siguiente</span>
                <ChevronRight />
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
