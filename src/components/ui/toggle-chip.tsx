/**
 * ToggleChip — HabitaPlan Design System
 *
 * Botón de selección exclusiva/toggle para grupos de opciones.
 * Reemplaza los `<button>` inline con clases duplicadas en Filters.tsx.
 *
 * Variantes:
 *   pill — rounded-full — chips horizontales (fecha, tags)
 *   tile — rounded-xl  — botones de grid o lista (edad, ordenar)
 *
 * Props:
 *   pressed    — estado activo (aria-pressed sincronizado automáticamente)
 *   fullWidth  — solo tile: ocupa ancho completo y alinea texto a la izquierda
 *
 * Estados accesibles:
 *   - aria-pressed reflejado desde `pressed`
 *   - focus-visible:ring para navegación por teclado (gap previo en Filters.tsx)
 *   - disabled: opacidad 40%, sin pointer-events
 */

import { clsx } from 'clsx';

export interface ToggleChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'pill' | 'tile';
  pressed?: boolean;
  /** Solo `tile`: hace el botón w-full + text-left */
  fullWidth?: boolean;
}

const BASE =
  'inline-flex items-center border text-sm font-medium transition-colors select-none ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 ' +
  'disabled:opacity-40 disabled:pointer-events-none';

const VARIANTS = {
  pill: 'rounded-full px-3 py-1 gap-1.5',
  tile: 'rounded-xl px-4 py-2.5 gap-2',
} as const;

const STATE = {
  active:   'border-brand-600 bg-brand-600 text-[var(--hp-primary)] shadow-[var(--hp-shadow-md)]',
  // text-white sobre brand-600 = 2.86:1 ❌ → text-[--hp-primary] (#002147) = 5.17:1 ✅ WCAG AA
  inactive: 'border-[var(--hp-border)] bg-[var(--hp-bg-surface)] text-[var(--hp-text-primary)] ' +
            'hover:border-brand-300 hover:text-brand-600',
} as const;

export function ToggleChip({
  variant = 'pill',
  pressed = false,
  fullWidth = false,
  className,
  children,
  ...props
}: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={clsx(
        BASE,
        VARIANTS[variant],
        pressed ? STATE.active : STATE.inactive,
        fullWidth && 'w-full text-left justify-between',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
