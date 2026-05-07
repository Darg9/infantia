'use client'
import { useEffect } from 'react'

/**
 * Muestra la alerta nativa del browser si el usuario intenta cerrar la
 * pestaña, recargar la página o navegar a una URL externa con cambios sin
 * guardar.
 *
 * Cobertura:
 *   ✅ Cerrar pestaña / ventana
 *   ✅ F5 / Ctrl+R (recarga)
 *   ✅ Browser back cuando destino es externo al SPA
 *   ❌ Clicks en <Link> internos de Next.js (no pasan por beforeunload)
 *
 * Para el botón de cancelar/volver usa el patrón de confirmación inline
 * que sí cubre ese caso.
 */
export function useBeforeUnload(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return

    function handler(e: BeforeUnloadEvent) {
      e.preventDefault()
      // Chrome requiere returnValue (deprecated pero necesario)
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}
