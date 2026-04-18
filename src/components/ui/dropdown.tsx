'use client'

/**
 * Dropdown — HabitaPlan Design System
 * Composición:
 * <Dropdown>
 *   <Dropdown.Trigger>
 *     <Avatar />
 *   </Dropdown.Trigger>
 *   <Dropdown.Menu>
 *     <Dropdown.Item onClick={...}>Opción 1</Dropdown.Item>
 *     <Dropdown.Divider />
 *     <Dropdown.Item>Opción 2</Dropdown.Item>
 *   </Dropdown.Menu>
 * </Dropdown>
 */

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  KeyboardEvent,
  ReactNode,
  useId,
} from 'react'
import { clsx } from 'clsx'

const DropdownContext = createContext<{
  isOpen: boolean
  toggle: () => void
  close: () => void
  menuId: string
  triggerId: string
  focusIndex: number
  setFocusIndex: (i: number) => void
  itemCount: number
  registerItem: (element: HTMLElement) => number
  unregisterItem: (element: HTMLElement) => void
} | null>(null)

// --- Provider ---
export function Dropdown({ children, className }: { children: ReactNode; className?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState(-1)
  const menuId = useId()
  const triggerId = useId()
  const ref = useRef<HTMLDivElement>(null)

  // Registro de items para la nevagación por teclado
  const itemsRef = useRef<HTMLElement[]>([])

  const registerItem = (el: HTMLElement) => {
    if (!itemsRef.current.includes(el)) {
      itemsRef.current.push(el)
      // Ordenar por su posición en el DOM.
      itemsRef.current.sort(
        (a, b) =>
          a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1
      )
    }
    return itemsRef.current.indexOf(el)
  }

  const unregisterItem = (el: HTMLElement) => {
    itemsRef.current = itemsRef.current.filter((i) => i !== el)
  }

  const toggle = () => {
    setIsOpen((prev) => {
      if (!prev) setFocusIndex(0) // Al abrir, resetear el foco al índice 0
      return !prev
    })
  }

  const close = () => {
    setIsOpen(false)
    setFocusIndex(-1)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        close()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Manejo de ESCAPE global para este dropdown
  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        close()
        // Retornar focus al trigger si es posible
        document.getElementById(triggerId)?.focus()
      }
    }
    if (isOpen) document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, triggerId])

  return (
    <DropdownContext.Provider
      value={{
        isOpen,
        toggle,
        close,
        menuId,
        triggerId,
        focusIndex,
        setFocusIndex,
        itemCount: itemsRef.current.length,
        registerItem,
        unregisterItem,
      }}
    >
      <div className={clsx('relative inline-block text-left', className)} ref={ref}>
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

// --- Trigger ---
export function DropdownTrigger({ children, asChild }: { children: ReactNode; asChild?: boolean }) {
  const ctx = useContext(DropdownContext)
  if (!ctx) throw new Error('DropdownTrigger debe estar dentro de Dropdown')

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (!ctx.isOpen) {
        ctx.toggle()
      } else if (e.key === 'ArrowDown') {
        ctx.setFocusIndex(0)
      }
    }
    if (e.key === 'ArrowUp' && ctx.isOpen) {
      e.preventDefault()
      ctx.setFocusIndex(ctx.itemCount - 1)
    }
  }

  return (
    <div
      role="button"
      id={ctx.triggerId}
      aria-haspopup="menu"
      aria-expanded={ctx.isOpen}
      aria-controls={ctx.isOpen ? ctx.menuId : undefined}
      tabIndex={0}
      onClick={ctx.toggle}
      onKeyDown={handleKeyDown}
      className={clsx(
        'inline-flex items-center justify-center cursor-pointer overflow-hidden rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 transition-all',
        !asChild && 'px-2 py-1'
      )}
    >
      {children}
    </div>
  )
}

// --- Menu ---
export function DropdownMenu({ children, className }: { children: ReactNode; className?: string }) {
  const ctx = useContext(DropdownContext)
  if (!ctx) throw new Error('DropdownMenu debe estar dentro de Dropdown')

  if (!ctx.isOpen) return null

  return (
    <div
      id={ctx.menuId}
      role="menu"
      aria-orientation="vertical"
      aria-labelledby={ctx.triggerId}
      className={clsx(
        'absolute right-0 mt-2 w-48 rounded-xl bg-[var(--hp-bg-surface)] dark:bg-gray-900 border border-[var(--hp-border)] dark:border-gray-800 shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 origin-top-right duration-100',
        className
      )}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          ctx.setFocusIndex((ctx.focusIndex + 1) % ctx.itemCount)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          ctx.setFocusIndex((ctx.focusIndex - 1 + ctx.itemCount) % ctx.itemCount)
        } else if (e.key === 'Tab') {
          // Tabulador de forma natural cierra si salimos del contexto, 
          // pero el user pide Tab comportamiento correcto.
          // Cerrar dropdown si tabulea fuera
          ctx.close()
        }
      }}
    >
      {children}
    </div>
  )
}

// --- Item ---
export function DropdownItem({
  children,
  className,
  onClick,
  danger,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  danger?: boolean
}) {
  const ctx = useContext(DropdownContext)
  if (!ctx) throw new Error('DropdownItem debe estar dentro de Dropdown')

  const ref = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(-1)

  useEffect(() => {
    if (ref.current) {
      setIndex(ctx.registerItem(ref.current))
    }
    return () => {
      if (ref.current) ctx.unregisterItem(ref.current)
    }
  }, [ctx])

  // Focus trap connection
  useEffect(() => {
    if (ctx.isOpen && ctx.focusIndex === index && ref.current) {
      ref.current.focus()
    }
  }, [ctx.focusIndex, index, ctx.isOpen])

  return (
    <div
      ref={ref}
      role="menuitem"
      tabIndex={-1}
      onClick={() => {
        if (onClick) onClick()
        ctx.close()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (onClick) onClick()
          ctx.close()
        }
      }}
      onMouseMove={() => ctx.setFocusIndex(index)}
      className={clsx(
        'block px-4 py-2 text-sm font-medium cursor-pointer transition-colors outline-none',
        danger
          ? 'text-gray-600 dark:text-[var(--hp-text-muted)] hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/30'
          : 'text-[var(--hp-text-primary)] dark:text-[var(--hp-text-muted)] hover:bg-[var(--hp-bg-page)] focus:bg-[var(--hp-bg-page)] dark:hover:bg-gray-800 dark:focus:bg-gray-800',
        className
      )}
    >
      {children}
    </div>
  )
}

// --- Divider ---
export function DropdownDivider() {
  return <div className="my-1 border-t border-[var(--hp-border)] dark:border-gray-800" role="separator" />
}

Dropdown.Trigger = DropdownTrigger
Dropdown.Menu = DropdownMenu
Dropdown.Item = DropdownItem
Dropdown.Divider = DropdownDivider
