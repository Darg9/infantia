'use client';
import { Button } from '@/components/ui';
/**
 * Modal — HabitaPlan Design System
 *
 * Diálogo accesible con overlay, foco atrapado y cierre por Escape.
 *
 * Tamaños:
 *   sm  — 400px  confirmaciones, alertas simples
 *   md  — 560px  formularios, detalles (default)
 *   lg  — 720px  contenido extenso
 *   xl  — 900px  paneles complejos
 *
 * Sub-componentes:
 *   Modal.Header  — título + descripción + botón ✕
 *   Modal.Body    — área de contenido scrollable
 *   Modal.Footer  — acciones alineadas a la derecha
 *
 * Uso:
 *   <Modal open={open} onClose={() => setOpen(false)} title="Confirmar eliminación">
 *     <Modal.Body>¿Seguro que quieres eliminar este elemento?</Modal.Body>
 *     <Modal.Footer>
 *       <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
 *       <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
 *     </Modal.Footer>
 *   </Modal>
 *
 * Accesibilidad:
 *   - role="dialog" aria-modal="true" aria-labelledby / aria-describedby
 *   - Foco atrapado dentro del modal mientras está abierto
 *   - Cierre con tecla Escape
 *   - Scroll del body bloqueado mientras el modal está abierto
 */


import {
  useEffect,
  useRef,
  useId,
  type ReactNode,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

export interface ModalProps {
  /** Controla si el modal está visible */
  open: boolean
  /** Llamado al hacer clic en el overlay o presionar Escape */
  onClose: () => void
  /** Título mostrado en Modal.Header (requerido para accesibilidad) */
  title: string
  /** Descripción opcional debajo del título */
  description?: string
  /** Tamaño del panel (default: 'md') */
  size?: ModalSize
  /** Oculta el botón ✕ en el header */
  hideCloseButton?: boolean
  /** Evita cerrar al hacer clic en el overlay */
  disableOverlayClose?: boolean
  children: ReactNode
  className?: string
}

const SIZE_MAP: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

// ─── Focus trap ───────────────────────────────────────────────────────────────

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function trapFocus(container: HTMLElement, e: KeyboardEvent<HTMLDivElement>) {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (!nodes.length) return
  const first = nodes[0]
  const last  = nodes[nodes.length - 1]
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus() }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus() }
  }
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  hideCloseButton = false,
  disableOverlayClose = false,
  children,
  className,
}: ModalProps) {
  const panelRef    = useRef<HTMLDivElement>(null)
  const titleId     = useId()
  const descId      = useId()

  // Block body scroll while open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [open])

  // Focus first focusable element on open
  useEffect(() => {
    if (!open || !panelRef.current) return
    const first = panelRef.current.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
  }, [open])

  if (!open) return null

  const panel = (
    // Overlay
    (<div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      aria-hidden="false"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        onClick={disableOverlayClose ? undefined : onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={clsx(
          'relative z-10 w-full flex flex-col',
          'bg-[var(--hp-bg-surface)] dark:bg-gray-900',
          'rounded-2xl shadow-xl border border-[var(--hp-border)] dark:border-gray-800',
          'max-h-[90vh]',
          SIZE_MAP[size],
          className,
        )}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.stopPropagation(); onClose() }
          if (e.key === 'Tab' && panelRef.current) trapFocus(panelRef.current, e)
        }}
      >
        {/* Header (always rendered — needed for aria-labelledby) */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-[var(--hp-border)] dark:border-gray-800 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2
              id={titleId}
              className="text-base font-semibold text-[var(--hp-text-primary)] dark:text-white leading-snug"
            >
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-sm text-[var(--hp-text-secondary)] dark:text-[var(--hp-text-muted)] mt-1">
                {description}
              </p>
            )}
          </div>
          {!hideCloseButton && (
            <Button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className={clsx(
                'flex-shrink-0 p-1.5 rounded-lg text-[var(--hp-text-muted)]',
                'hover:bg-gray-100 hover:text-gray-600',
                'dark:hover:bg-gray-800 dark:hover:text-[var(--hp-text-muted)]',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              )}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </Button>
          )}
        </div>

        {/* Content (children) */}
        {children}
      </div>
    </div>)
  )

  return createPortal(panel, document.body)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ModalBodyProps {
  children: ReactNode
  className?: string
}

function ModalBody({ children, className }: ModalBodyProps) {
  return (
    <div className={clsx('px-6 py-5 overflow-y-auto flex-1', className)}>
      {children}
    </div>
  )
}

interface ModalFooterProps {
  children: ReactNode
  className?: string
}

function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={clsx(
        'flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0',
        'border-t border-[var(--hp-border)] dark:border-gray-800',
        className,
      )}
    >
      {children}
    </div>
  )
}

Modal.Body   = ModalBody
Modal.Footer = ModalFooter
