'use client'

// =============================================================================
// ThemeToggle — Botón sun/moon para alternar tema
//
// Client Component aislado → se puede insertar en cualquier Server Component
// (Header, layout, etc.) sin contaminar el árbol SSR.
//
// SVG inline: 0 dependencias adicionales, bundle mínimo.
// =============================================================================

import { useTheme } from '@/hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      id="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="
        flex items-center justify-center
        w-8 h-8 rounded-[var(--hp-radius-md)]
        text-[var(--hp-text-secondary)]
        hover:text-[var(--hp-text-primary)]
        hover:bg-[var(--hp-bg-subtle)]
        transition-colors duration-[var(--hp-transition)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
      "
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

// ── Ícono Luna (modo claro activo → ofrecer dark) ──────────────────────────
function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

// ── Ícono Sol (modo oscuro activo → ofrecer light) ─────────────────────────
function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}
