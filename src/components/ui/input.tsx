import { Input } from "@/components/ui/input";
/**
 * Input — HabitaPlan Design System
 *
 * Estados:
 *   default  — borde gris, focus naranja
 *   error    — borde rojo + mensaje inline
 *   disabled — opacidad reducida, cursor not-allowed
 *
 * Slots:
 *   leftSlot  — ícono o prefijo (e.g. lupa, @)
 *   rightSlot — botón toggle (e.g. mostrar contraseña) o unidad
 *
 * Uso:
 *   <Input id="email" label="Email" type="email" error="Formato inválido" />
 *   <Input id="pass" label="Contraseña" type="password" rightSlot={<EyeToggle />} />
 */

import { clsx } from 'clsx'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string
  label: string
  /** Mensaje de error inline. También cambia el estilo del borde. */
  error?: string | null
  /** Permite esconder el label visualmente pero mantiene accesibilidad */
  hideLabel?: boolean
  /** Descripción auxiliar debajo del label */
  hint?: string
  leftSlot?: React.ReactNode
  rightSlot?: React.ReactNode
}

export function Input({
  id,
  label,
  error,
  hint,
  leftSlot,
  rightSlot,
  required,
  disabled,
  hideLabel,
  className,
  ...props
}: InputProps) {
  return (
    <div className="space-y-1.5">
      {/* Label */}
      <label
        htmlFor={id}
        className={clsx(
          hideLabel ? 'sr-only' : 'block text-sm font-medium text-hp-text-primary'
        )}
      >
        {label}
        {required && (
          <span className="text-error-500 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {hint && (
        <p className="text-xs text-hp-text-secondary -mt-1">{hint}</p>
      )}
      {/* Input wrapper */}
      <div className="relative">
        {leftSlot && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-hp-text-secondary">
            {leftSlot}
          </div>
        )}

        <Input
          id={id}
          required={required}
          disabled={disabled}
          aria-required={required}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          aria-invalid={error ? true : undefined}
          className={clsx(
            // Base
            'w-full text-sm bg-hp-bg-surface',
            'text-hp-text-primary',
            'placeholder:text-hp-text-secondary',
            'border rounded-xl transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            // Padding con slots
            leftSlot ? 'pl-10' : 'pl-3.5',
            rightSlot ? 'pr-10' : 'pr-3.5',
            'py-2.5',
            // Estado error vs default
            error
              ? 'border-error-400 focus:ring-error-400 focus:border-error-400 focus:ring-opacity-30'
              : 'border-hp-border-subtle focus:ring-hp-action-primary focus:border-hp-action-primary',
            // Disabled
            disabled && 'opacity-50 cursor-not-allowed bg-hp-bg-page',
            className
          )}
          {...props}
        />

        {rightSlot && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>
        )}
      </div>
      {/* Error message */}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-center gap-1 text-xs text-error-600 dark:text-error-400"
        >
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
