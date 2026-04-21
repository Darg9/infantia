/**
 * Button — HabitaPlan Design System
 *
 * Variantes:
 *   primary     — naranja sólido  → acción principal de la pantalla (1 por sección)
 *   secondary   — outline         → acción secundaria (guarda pero menor jerarquía)
 *   ghost       — texto plano     → acción terciaria / links de baja prioridad
 *   destructive — rojo sólido     → eliminar, revocar, cancelar permanente
 *
 * Tamaños:
 *   sm — formularios compactos, tablas
 *   md — default, la mayoría de los casos
 *   lg — CTAs hero / landing
 *
 * Estados: hover / focus-visible / active / disabled / loading (todos obligatorios)
 */

import { clsx } from 'clsx'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  /** Permite pasar clases extra sin sobreescribir el sistema de variantes */
  className?: string
}

const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'disabled:pointer-events-none disabled:select-none ' +
  'select-none whitespace-nowrap'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-hp-action-primary text-white hover:bg-hp-action-primary-hover active:opacity-90 ' +
    'disabled:bg-hp-bg-subtle disabled:text-hp-text-muted ' +
    'focus-visible:ring-hp-action-primary',

  secondary:
    'border border-hp-border-subtle text-hp-text-primary bg-transparent ' +
    'hover:bg-hp-bg-subtle active:opacity-90 ' +
    'disabled:opacity-50 disabled:bg-transparent ' +
    'focus-visible:ring-hp-text-primary',

  ghost:
    'bg-transparent text-hp-text-secondary hover:bg-hp-bg-subtle hover:text-hp-text-primary active:opacity-90 ' +
    'disabled:opacity-50 disabled:bg-transparent ' +
    'focus-visible:ring-hp-bg-subtle',

  destructive:
    'bg-error-500 text-white hover:bg-error-600 active:bg-error-600 ' +
    'disabled:opacity-50 ' +
    'focus-visible:ring-error-500',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
}

export function buttonVariants({ variant = 'primary', size = 'md', className }: Pick<ButtonProps, 'variant' | 'size' | 'className'>) {
  return clsx(BASE, VARIANTS[variant], SIZES[size], className)
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('animate-spin', className)}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      className={buttonVariants({ variant, size, className })}
      {...props}
    >
      {loading && (
        <SpinnerIcon
          className={clsx('shrink-0', size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4')}
        />
      )}
      {children}
    </button>
  )
}
