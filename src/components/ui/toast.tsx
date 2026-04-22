'use client';
/**
 * Toast — HabitaPlan Design System
 *
 * Arquitectura:
 *   ToastProvider  → envuelve el app en layout.tsx
 *   useToast()     → hook para disparar toasts desde cualquier componente
 *   ToastRegion    → renderiza la cola en fixed top-right
 *
 * Reglas:
 *   - Máximo 3 visibles simultáneamente (FIFO: se elimina el más antiguo)
 *   - Auto-dismiss: 2500ms por defecto (configurable)
 *   - Dismiss manual con botón ✕
 *   - aria-live="polite" para lectores de pantalla
 *
 * Tipos:
 *   success  — acción completada (✓ verde)
 *   error    — fallo de operación (⚠ rojo)
 *   warning  — advertencia no bloqueante (! amarillo)
 *   info     — información neutral (ℹ azul)
 *
 * Uso:
 *   const { toast } = useToast()
 *   toast.success('Perfil actualizado')
 *   toast.error('Error de conexión')
 *   toast.show({ type: 'warning', text: 'Archivo grande', duration: 4000 })
 */


import { createContext, useCallback, useContext, useReducer, useRef } from 'react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastActionPayload {
  label: string
  href?: string
  onClick?: () => void
}

interface ToastOptions {
  type: ToastType
  text: string
  duration?: number
  action?: ToastActionPayload
}

export interface ToastItem {
  id: number
  type: ToastType
  text: string
  duration: number
  timestamp: number
  action?: ToastActionPayload
}

export interface ToastMethodOptions {
  duration?: number
  action?: ToastActionPayload
}

// API plana — sin callable-object para cumplir react-hooks/immutability
export interface ToastAPI {
  /** Dispara un toast genérico */
  show:    (options: ToastOptions) => void
  success: (text: string, options?: ToastMethodOptions | number) => void
  error:   (text: string, options?: ToastMethodOptions | number) => void
  warning: (text: string, options?: ToastMethodOptions | number) => void
  info:    (text: string, options?: ToastMethodOptions | number) => void
}

interface ToastContextValue {
  toast: ToastAPI
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_VISIBLE = 3
const DEFAULT_DURATION = 2500

// ─── Reducer ──────────────────────────────────────────────────────────────────

type ToastAction =
  | { type: 'ADD';     payload: ToastItem }
  | { type: 'DISMISS'; id: number }

function toastReducer(state: ToastItem[], action: ToastAction): ToastItem[] {
  if (action.type === 'ADD') {
    // Evitar duplicados (mismo type + text dentro de los últimos 2000ms)
    const isDuplicate = state.some(
      (t) => t.type === action.payload.type && t.text === action.payload.text && action.payload.timestamp - t.timestamp < 2000
    )
    if (isDuplicate) return state

    // FIFO: si ya hay MAX_VISIBLE, eliminar el más antiguo antes de agregar
    const trimmed = state.length >= MAX_VISIBLE ? state.slice(1) : state
    return [...trimmed, action.payload]
  }
  if (action.type === 'DISMISS') {
    return state.filter((item) => item.id !== action.id)
  }
  return state
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, dispatch] = useReducer(toastReducer, [])
  const counter = useRef(0)
  const timers  = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id)
    if (t) { clearTimeout(t); timers.current.delete(id) }
    dispatch({ type: 'DISMISS', id })
  }, [])

  const add = useCallback((options: ToastOptions) => {
    const id       = ++counter.current
    const duration = options.duration ?? (options.action ? 4000 : DEFAULT_DURATION)
    dispatch({ type: 'ADD', payload: { id, type: options.type, text: options.text, duration, timestamp: Date.now(), action: options.action } })
    const t = setTimeout(() => dismiss(id), duration)
    timers.current.set(id, t)
  }, [dismiss])

  const pause = useCallback((id: number) => {
    const t = timers.current.get(id)
    if (t) { clearTimeout(t); timers.current.delete(id) }
  }, [])

  const resume = useCallback((id: number, duration: number) => {
    const t = setTimeout(() => dismiss(id), duration)
    timers.current.set(id, t)
  }, [dismiss])

  // Helper para manejar compatibilidad con (text, duration) vs (text, options)
  const parseOpts = (opts?: ToastMethodOptions | number): ToastMethodOptions => {
    if (typeof opts === 'number') return { duration: opts }
    return opts ?? {}
  }

  const showToast    = useCallback((opts: ToastOptions) => add(opts), [add])
  const toastSuccess = useCallback((text: string, opts?: ToastMethodOptions | number) => { const o = parseOpts(opts); add({ type: 'success', text, duration: o.duration, action: o.action }) }, [add])
  const toastError   = useCallback((text: string, opts?: ToastMethodOptions | number) => { const o = parseOpts(opts); add({ type: 'error',   text, duration: o.duration, action: o.action }) }, [add])
  const toastWarning = useCallback((text: string, opts?: ToastMethodOptions | number) => { const o = parseOpts(opts); add({ type: 'warning', text, duration: o.duration, action: o.action }) }, [add])
  const toastInfo    = useCallback((text: string, opts?: ToastMethodOptions | number) => { const o = parseOpts(opts); add({ type: 'info',    text, duration: o.duration, action: o.action }) }, [add])

  // El contexto expone el objeto toast con todos los métodos como propiedades.
  // Se usa useMemo sobre un objeto literal — los valores son los callbacks ya memoizados.
  // Esto es idiomático en React y no viola ninguna regla de hooks.
  const contextValue = useCallback(
    () => ({
      toast: {
        show:    showToast,
        success: toastSuccess,
        error:   toastError,
        warning: toastWarning,
        info:    toastInfo,
      } satisfies ToastAPI,
    }),
    [showToast, toastSuccess, toastError, toastWarning, toastInfo]
  )

  return (
    <ToastContext.Provider value={contextValue()}>
      {children}
      <ToastRegion items={items} onDismiss={dismiss} onPause={pause} onResume={resume} />
    </ToastContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function ToastIcon({ type }: { type: ToastType }) {
  if (type === 'success') return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
  if (type === 'error') return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  )
  if (type === 'warning') return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
    </svg>
  )
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
  )
}

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-success-600 text-white',
  error:   'bg-error-600 text-white',
  warning: 'bg-warning-500 text-white',
  info:    'bg-hp-text-primary text-hp-bg-surface',
}

// ─── Region (renderizado) ─────────────────────────────────────────────────────

import Link from 'next/link'

interface ToastRegionProps {
  items: ToastItem[]
  onDismiss: (id: number) => void
  onPause: (id: number) => void
  onResume: (id: number, duration: number) => void
}

function ToastRegion({ items, onDismiss, onPause, onResume }: ToastRegionProps) {
  if (items.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Notificaciones"
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 max-sm:bottom-6 max-sm:left-4 max-sm:right-4 z-50 flex flex-col gap-2 pointer-events-none"
    >
      {/* Reverse items so newest is at the bottom when in bottom position */}
      {[...items].reverse().map((item) => (
        <div
          key={item.id}
          role="status"
          onMouseEnter={() => onPause(item.id)}
          onMouseLeave={() => onResume(item.id, item.duration)}
          className={clsx(
            'flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]',
            'text-sm font-medium w-full max-sm:max-w-full max-w-sm pointer-events-auto',
            'animate-in fade-in slide-in-from-bottom-5 duration-300',
            TOAST_STYLES[item.type]
          )}
        >
          <ToastIcon type={item.type} />
          
          <div className="flex-1 flex items-center justify-between gap-3">
            <span className="leading-snug">{item.text}</span>
            {item.action && (
              <div className="shrink-0 flex items-center border-l border-current/20 pl-3">
                {item.action.href ? (
                  <Link 
                    href={item.action.href}
                    onClick={() => onDismiss(item.id)}
                    className="font-bold hover:opacity-80 transition-opacity"
                  >
                    {item.action.label}
                  </Link>
                ) : (
                  <Button
                    onClick={() => {
                      if (item.action?.onClick) item.action.onClick();
                      onDismiss(item.id);
                    }}
                    className="font-bold hover:opacity-80 transition-opacity"
                  >
                    {item.action.label}
                  </Button>
                )}
              </div>
            )}
          </div>

          <Button
            onClick={() => onDismiss(item.id)}
            aria-label="Cerrar notificación"
            className="p-1 rounded-lg hover:bg-white/20 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-white ml-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
      ))}
    </div>
  );
}
