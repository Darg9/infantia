import * as React from "react"
import { clsx } from "clsx"

export interface ActionCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

/**
 * ActionCard — HabitaPlan Design System
 * 
 * Una tarjeta interactiva que se comporta como un botón.
 * Diseñada para evitar el uso incorrecto de <Button> como contenedor de layouts complejos.
 * Mantiene la accesibilidad (focus-visible) y los estados interactivos estándar.
 * 
 * Por defecto aplica un layout flex-col con alineación inicial.
 */
export const ActionCard = React.forwardRef<HTMLButtonElement, ActionCardProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={clsx(
          // Estructura base
          "group relative flex w-full flex-col items-start text-left",
          "p-6 rounded-2xl border-2 transition-all",
          // Colores y bordes (tematizados)
          "border-[var(--hp-border)] bg-[var(--hp-bg-surface)] text-[var(--hp-text-primary)]",
          // Estados interactivos
          "hover:border-brand-300 hover:bg-brand-50 active:opacity-90",
          "disabled:pointer-events-none disabled:opacity-50",
          // Accesibilidad
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
ActionCard.displayName = "ActionCard"
