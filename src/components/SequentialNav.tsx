'use client'

// =============================================================================
// SequentialNav — Navegación editorial prev/next entre actividades.
//
// V4: Affordance y semántica.
//   - aria-labels descriptivos en español con título completo
//   - title tooltip muestra nombre completo cuando el texto está truncado
//   - underline sutil on hover (decoration-transparent → decoration-current)
//   - micro-animation en flechas: ±2px en dirección de navegación
//   - active:opacity-70 para feedback táctil
//
// Una sola instancia inline bajo el breadcrumb. Mobile compacto (< sm).
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

// Flechas — micro-animation: se desplazan 2px en dirección de navegación on hover.
// El grupo (link) gestiona la transición; las flechas reaccionan.
function ChevronLeft() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"
      className="shrink-0 opacity-40 group-hover:opacity-100 group-hover:-translate-x-0.5 transition-all duration-150"
    >
      <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"
      className="shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-150"
    >
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

  // Clases compartidas para los links de navegación.
  // underline-offset-2 + decoration-transparent reserva el espacio del underline
  // desde el inicio — evita layout shift al hacer hover.
  const linkBase =
    'group flex items-center gap-1.5 text-[var(--hp-text-primary)] hover:text-brand-600 ' +
    'underline-offset-2 decoration-transparent group-hover:decoration-current ' +
    'transition-colors duration-150 active:opacity-70 py-1 -my-1'

  return (
    <div className="mx-auto max-w-4xl px-4 mt-4">
      <nav
        className="mx-auto max-w-2xl rounded-2xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] shadow-sm"
        aria-label="Explorar actividades"
      >
        <div className="flex items-center px-6 py-3.5">

          {/* ── Anterior ─────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {prevItem ? (
              <Link
                href={activityPath(prevItem.id, prevItem.title)}
                className={linkBase}
                aria-label={`Ir a la actividad anterior: ${prevItem.title}`}
                title={`Actividad anterior: ${prevItem.title}`}
              >
                <ChevronLeft />
                <span className="hidden sm:block truncate text-sm font-medium leading-snug">
                  {prevItem.title}
                </span>
                <span className="sm:hidden text-sm font-medium whitespace-nowrap">Anterior</span>
              </Link>
            ) : (
              <span className="invisible select-none text-sm" aria-hidden="true">—</span>
            )}
          </div>

          {/* ── Contador — metadata recesiva ──────────────────────────────── */}
          <span
            className="shrink-0 text-[11px] tabular-nums select-none opacity-60 text-[var(--hp-text-muted)] px-5"
            aria-label={`Actividad ${currentIndex + 1} de ${ctx.items.length}`}
          >
            {position}
          </span>

          {/* ── Siguiente ────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 overflow-hidden flex justify-end">
            {nextItem ? (
              <Link
                href={activityPath(nextItem.id, nextItem.title)}
                className={`${linkBase} min-w-0 max-w-full`}
                aria-label={`Ir a la siguiente actividad: ${nextItem.title}`}
                title={`Siguiente actividad: ${nextItem.title}`}
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
