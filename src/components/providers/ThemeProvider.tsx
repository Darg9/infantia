'use client'

// =============================================================================
// ThemeProvider — Sistema de tema light/dark (HabitaPlan)
//
// Fuente de verdad: la clase "dark" en <html>, que el script anti-flash
// ya setea correctamente antes del render. No recalculamos el tema aquí,
// solo lo leemos y exponemos la capacidad de cambiarlo.
//
// Prioridad:
//   1. localStorage.theme  → elección manual del usuario
//   2. prefers-color-scheme → valor inicial del sistema
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Leer la fuente de verdad directamente desde <html> (ya seteada por el
  // script anti-flash). Nunca recalcular para evitar desincronización.
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  })

  // Sincronizar en caso de que el estado cambie externamente (poco probable,
  // pero defensivo).
  useEffect(() => {
    const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    setTheme(current)
  }, [])

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'

    // 1. Actualizar clase en <html> → CSS reacciona inmediatamente
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
