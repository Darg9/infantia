'use client'

// =============================================================================
// ThemeProvider — Sistema de tema light/dark (HabitaPlan)
//
// Prioridad de resolución (resolveTheme + script anti-flash en layout.tsx):
//   1. localStorage.theme  → elección manual del usuario (fuente primaria)
//   2. Cookie hp-theme      → fallback Brave Shields / localStorage bloqueado
//                             SOLO se escribe cuando el usuario hace toggle manual.
//                             NO se escribe en auto-detección del sistema — de lo
//                             contrario una visita con sistema=light crea una cookie
//                             stale que bloquea futuros cambios del sistema.
//   3. prefers-color-scheme → preferencia del SO (fuente dinámica, sin persistir)
//
// Funcionalidades:
//   - SSR-safe: guard typeof window en useState initializer
//   - Cross-tab sync: storage event propaga el tema a otras pestañas
//   - Live system sync: matchMedia 'change' actualiza el tema cuando el SO cambia
//     (solo si no hay elección manual en localStorage ni cookie)
//   - Sin setState síncrono en effects (eslint react-hooks/set-state-in-effect)
// =============================================================================

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
})

function resolveTheme(): Theme {
  if (typeof window === 'undefined') return 'light'

  // 1. localStorage — fuente principal
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch { /* localStorage bloqueado (Brave Shields, incógnito estricto) */ }

  // 2. Cookie hp-theme — fallback robusto para browsers con localStorage restrictivo
  try {
    const m = document.cookie.match(/(?:^|;\s*)hp-theme=(dark|light)/)
    if (m) return m[1] as Theme
  } catch { /* cookie API restringida */ }

  // 3. OS preference — último recurso
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Leer fuente de verdad (localStorage) en el initializer — sin efecto síncrono.
  const [theme, setTheme] = useState<Theme>(resolveTheme)

  // Efecto 1: re-aplicar clase CSS si la hidratación la eliminó.
  // No llama setState — solo opera sobre el DOM.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Efecto 2: cross-tab sync. setState solo dentro del callback del evento
  // (no sincrónico en el body del effect) → cumple eslint set-state-in-effect.
  useEffect(() => {
    function handleStorageChange(e: StorageEvent) {
      if (e.key !== 'theme') return
      const next = e.newValue
      if (next !== 'dark' && next !== 'light') return
      document.documentElement.classList.toggle('dark', next === 'dark')
      setTheme(next as Theme)
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Efecto 3: seguir cambios del sistema en tiempo real (macOS auto-switch día/noche,
  // usuario cambia preferencia mientras el app está abierto).
  // Solo aplica cuando NO hay elección manual explícita (sin localStorage ni cookie).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')

    function handleSystemChange(e: MediaQueryListEvent) {
      // Si hay elección manual, el sistema no manda
      try { if (localStorage.getItem('theme')) return } catch { /* bloqueado */ }
      try { if (document.cookie.match(/(?:^|;\s*)hp-theme=/)) return } catch { /* bloqueado */ }

      const next: Theme = e.matches ? 'dark' : 'light'
      document.documentElement.classList.toggle('dark', next === 'dark')
      setTheme(next)
    }

    mq.addEventListener('change', handleSystemChange)
    return () => mq.removeEventListener('change', handleSystemChange)
  }, [])

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'

    // 1. Actualizar clase en <html> → CSS reacciona inmediatamente
    // color-scheme se actualiza automáticamente vía CSS (.dark { color-scheme: dark })
    document.documentElement.classList.toggle('dark', next === 'dark')

    // 2. Persistir elección del usuario (localStorage + cookie para SSR)
    localStorage.setItem('theme', next)
    document.cookie = `hp-theme=${next}; path=/; max-age=31536000; SameSite=Lax`

    // 3. Actualizar estado React → re-render del toggle
    setTheme(next)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useThemeContext() {
  return useContext(ThemeContext)
}
