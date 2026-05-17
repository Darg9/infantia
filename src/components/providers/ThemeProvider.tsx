'use client'

// =============================================================================
// ThemeProvider — Sistema de tema light/dark (HabitaPlan)
//
// Prioridad de resolución (resolveTheme + script anti-flash en layout.tsx):
//   1. localStorage.theme  → elección manual del usuario (fuente primaria)
//   2. Cookie hp-theme      → fallback SOLO cuando localStorage está BLOQUEADO
//                             (Brave Shields, incógnito estricto). NO se lee si
//                             localStorage es accesible pero vacío — eso significa
//                             "sin elección manual", y la cookie podría ser stale
//                             de versiones anteriores del código.
//                             SOLO se escribe cuando el usuario hace toggle manual.
//   3. prefers-color-scheme → preferencia del SO (fuente dinámica, sin persistir)
//
// Funcionalidades:
//   - SSR-safe: guard typeof window en useState initializer
//   - Cross-tab sync: storage event propaga el tema a otras pestañas
//   - Live system sync: matchMedia 'change' actualiza el tema cuando el SO cambia
//     (solo si no hay elección manual en localStorage ni cookie)
//   - Sin setState síncrono en effects (eslint react-hooks/set-state-in-effect)
// =============================================================================

import { createContext, useContext, useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react'

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
  let lsBlocked = false
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') return saved
    // localStorage accesible pero vacío → sin elección manual → saltar cookie → usar sistema
  } catch { lsBlocked = true /* localStorage bloqueado: Brave Shields, incógnito estricto */ }

  // 2. Cookie hp-theme — SOLO cuando localStorage está completamente bloqueado.
  //    Si lsBlocked=false y saved=null → no hay elección manual → NO leer cookie.
  //    Una cookie stale (escrita por versiones anteriores en auto-detección) ganaría
  //    sobre el sistema y bloquearía futuros cambios del SO durante 1 año.
  if (lsBlocked) {
    try {
      const m = document.cookie.match(/(?:^|;\s*)hp-theme=(dark|light)/)
      if (m) return m[1] as Theme
    } catch { /* cookie API restringida */ }
  }

  // 3. OS preference — último recurso
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Leer fuente de verdad (localStorage) en el initializer — sin efecto síncrono.
  const [theme, setTheme] = useState<Theme>(resolveTheme)

  // Captura el tema inicial para useLayoutEffect (el hook solo corre en mount).
  const initialTheme = useRef(theme)

  // Efecto 1: ANTES del primer paint (useLayoutEffect).
  // Confirma la clase .dark y elimina no-transition que añadió el script anti-flash.
  // Usar useLayoutEffect (no rAF, no useEffect) garantiza que:
  //   1. Las transiciones CSS solo se activan DESPUÉS de que React ha aplicado el tema.
  //   2. No hay flash: el DOM es correcto antes de que el browser pinte.
   
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', initialTheme.current === 'dark')
    document.documentElement.classList.remove('no-transition')
  }, []) // mount-only: no re-dispara en cambios de tema (esos van en Efecto 2)

  // Efecto 2: cambios de tema subsecuentes (toggle manual, cross-tab, sistema).
  // Corre DESPUÉS del paint → las transiciones CSS de 180ms animan el cambio. ✅
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Efecto 3: cross-tab sync. setState solo dentro del callback del evento
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

  // Efecto 4: seguir cambios del sistema en tiempo real (macOS auto-switch día/noche,
  // usuario cambia preferencia mientras el app está abierto).
  // Solo aplica cuando NO hay elección manual explícita (sin localStorage ni cookie).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')

    function handleSystemChange(e: MediaQueryListEvent) {
      // Si hay elección manual en localStorage, el sistema no manda
      try {
        if (localStorage.getItem('theme')) return
        // localStorage accesible pero vacío → sin elección manual → dejar pasar
        // (no leer cookie: podría ser stale de versiones anteriores)
      } catch {
        // localStorage bloqueado → revisar cookie como fuente de elección manual
        try { if (document.cookie.match(/(?:^|;\s*)hp-theme=/)) return } catch { /* bloqueado */ }
      }

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

    // 2. Persistir elección del usuario
    try { localStorage.setItem('theme', next) } catch { /* Brave Shields */ }
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
