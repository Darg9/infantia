'use client'

// =============================================================================
// ThemeProvider — Sistema de tema light/dark (HabitaPlan)
//
// Fuente de verdad: localStorage.theme (misma prioridad que el script anti-flash).
//
// Prioridad:
//   1. localStorage.theme  → elección manual del usuario
//   2. prefers-color-scheme → fallback del sistema
//
// Funcionalidades:
//   - SSR-safe: guard typeof window en useState initializer
//   - Cross-tab sync: storage event propaga el tema a otras pestañas
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
  const saved = localStorage.getItem('theme')
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Leer fuente de verdad (localStorage) en el initializer — sin efecto síncrono.
  const [theme, setTheme] = useState<Theme>(resolveTheme)

  // Efecto 1: re-aplicar clase CSS si la hidratación la eliminó.
  // También limpia el inline style backgroundColor que el script anti-flash dejó en <html>
  // para que los CSS vars tomen control (inline styles tienen máxima especificidad
  // y bloquearían la actualización del fondo al hacer toggle).
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.removeProperty('background-color')
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

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'

    // 1. Actualizar clase en <html> → CSS reacciona inmediatamente
    // color-scheme se actualiza automáticamente vía CSS (.dark { color-scheme: dark })
    document.documentElement.classList.toggle('dark', next === 'dark')

    // 2. Persistir elección del usuario
    localStorage.setItem('theme', next)

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
