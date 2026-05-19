/**
 * HabitaPlan Design Tokens
 * Fuente de verdad: src/app/globals.css (@theme + :root)
 * Usar estas constantes en tests, scripts y documentación.
 * En componentes, usar directamente las clases Tailwind (bg-brand-500, etc.)
 */

export const colors = {
  brand: {
    50:  '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#ff8c00',  // naranja HabitaPlan (acción principal)
    600: '#e67e00',  // hover / active state (ToggleChip active)
    700: '#c96d00',
    800: '#9a4f00',
    900: '#6b3600',
  },
  status: {
    success: { 500: '#22c55e', 600: '#16a34a' },
    error:   { 500: '#ef4444', 600: '#dc2626' },
    warning: { 500: '#f59e0b', 600: '#d97706' },
  },
} as const

export const semantic = {
  primary:   '#002147',  // azul marino HabitaPlan
  accent:    '#ff8c00',  // naranja (= brand-500)

  text: {
    primary:   '#002147',
    secondary: 'rgba(0, 33, 71, 0.7)',
    muted:     'rgba(0, 33, 71, 0.5)',
  },
  bg: {
    page:    '#f8fafc',  // canvas — slate-50
    surface: '#ffffff',  // cards, modales
    subtle:  '#f1f5f9',  // hover, fondos secundarios
  },
  border: {
    subtle: 'rgba(0, 33, 71, 0.1)',
  },
  action: {
    /**
     * Split por modo — WCAG AA en ambos.
     * Light: #9e5200 (5.73:1 sobre blanco / 5.24:1 sobre bg-subtle ✅) | Dark: #ff8c00 (7.62:1 sobre #111827)
     * En componentes usar var(--hp-action-primary) — globals.css aplica el override dark.
     * brand-500 (#ff8c00) sigue siendo el naranja decorativo en ambos modos.
     */
    primary:      '#9e5200',       // light — WCAG AA (actualizado S74: pasa sobre bg-subtle)
    primaryDark:  '#ff8c00',       // dark override (en globals.css .dark)
    primaryHover: '#7d3e00',       // light
    primaryHoverDark: '#e67e00',   // dark override
  },
} as const

export const radius = {
  sm: '8px',
  md: '12px',
  lg: '16px',
} as const

export const typography = {
  fontFamily: 'Inter, system-ui, sans-serif',
  scale: {
    xs:   '0.75rem',   // 12px
    sm:   '0.875rem',  // 14px
    base: '1rem',      // 16px
    lg:   '1.125rem',  // 18px
    xl:   '1.25rem',   // 20px
    '2xl':'1.5rem',    // 24px
    '3xl':'1.875rem',  // 30px
  },
} as const
