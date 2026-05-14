'use client'

// =============================================================================
// ActivityListTracker — Componente invisible que guarda el contexto de
// navegación secuencial en sessionStorage cuando el usuario está en el
// listado de /actividades.
//
// - Solo actúa en vista lista (nunca en mapa).
// - Se monta una vez por carga de página → efecto con [] como deps.
// - El componente es null en el DOM — no añade markup visible.
// =============================================================================

import { useEffect } from 'react'

const NAV_KEY = 'hp_nav_ctx'

export interface NavItem {
  id: string
  title: string
}

interface Props {
  items: NavItem[]
  returnUrl: string
}

export function ActivityListTracker({ items, returnUrl }: Props) {
  useEffect(() => {
    if (items.length === 0) return
    try {
      sessionStorage.setItem(
        NAV_KEY,
        JSON.stringify({ items, returnUrl, storedAt: Date.now() }),
      )
    } catch {
      // sessionStorage no disponible (modo privado, cuota llena, etc.) — silenciar
    }
    // Dep array vacío es intencional: este efecto debe correr solo al montar.
    // Cada navegación a /actividades crea una instancia fresca del componente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
