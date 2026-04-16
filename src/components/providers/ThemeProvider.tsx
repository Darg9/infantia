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
//
// Funcionalidades de producción:
//   - SSR-safe: guard typeof window en initializer (ajuste 2)
//   - Cross-tab sync: storage event propaga el tema a otras pestañas (ajuste 1)
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

  // Sincronización inicial + cross-tab:
  // - En mount, lee el estado real del <html> (defensivo contra hydration gaps)
  // - Escucha el evento 'storage' para propagar cambios desde otras pestañas
  //   sin reload. Si el usuario cambia el tema en tab A, tab B lo refleja
  //   instantáneamente.
  useEffect(() => {
    // SSR guard redundante pero explícito (ajuste 2)
    if (typeof window === 'undefined') return

    // Sincronización inicial
    const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    setTheme(current)

    // Cross-tab sync (ajuste 1)
    function handleStorageChange(e: StorageEvent) {
      if (e.key !== 'theme') return
      const next = e.newValue
      if (next !== 'dark' && next !== 'light') return
      document.documentElement.classList.toggle('dark', next === 'dark')
      setTheme(next)
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
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
