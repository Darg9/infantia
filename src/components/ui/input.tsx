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
  className,
  ...props
}: InputProps) {
  return (
    <div className="space-y-1.5">
      {/* Label */}
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
        {required && (
          <span className="text-error-500 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {hint && (
        <p className="text-xs text-gray-400 dark:text-gray-500 -mt-1">{hint}</p>
      )}

      {/* Input wrapper */}
      <div className="relative">
        {leftSlot && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {leftSlot}
          </div>
        )}

        <input
          id={id}
          required={required}
          disabled={disabled}
          aria-required={required}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          aria-invalid={error ? true : undefined}
          className={clsx(
            // Base
            'w-full text-sm bg-white dark:bg-gray-800',
            'text-gray-900 dark:text-white',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'border rounded-xl transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            // Padding con slots
            leftSlot ? 'pl-10' : 'pl-3.5',
            rightSlot ? 'pr-10' : 'pr-3.5',
            'py-2.5',
            // Estado error vs default
            error
              ? 'border-error-400 dark:border-error-500 focus:ring-error-400/30 focus:border-error-400'
              : 'border-gray-200 dark:border-gray-700 focus:ring-brand-500/25 focus:border-brand-500 dark:focus:border-brand-400',
            // Disabled
            disabled && 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900',
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
  )
}
