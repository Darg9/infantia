"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/track";

/**
 * Discovery Observability Layer
 * Mide la velocidad de descubrimiento significativo: delta desde navigationStart hasta el primer click en una actividad.
 * Ignora clicks < 300ms (toques accidentales/residuales).
 */
export function TimeToFirstActivityTracker() {
  const isTracked = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || isTracked.current) return;

    const navStart = performance.timing.navigationStart;

    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (isTracked.current) return;

      // Buscar si el click fue dentro de un elemento marcado como actividad
      const target = e.target as HTMLElement;
      const activityNode = target.closest('[data-activity-target="true"]');

      if (activityNode) {
        const now = Date.now();
        const delta = now - navStart;

        // Ignorar clicks muy rápidos (probables scroll/tap accidentales)
        if (delta > 300) {
          isTracked.current = true;
          const activityId = activityNode.getAttribute("data-activity-id") || undefined;
          
          void trackEvent({
            type: "time_to_first_activity_click",
            activityId,
            metadata: { delta_ms: delta },
          });

          // Limpiar listener una vez capturado
          cleanup();
        }
      }
    };

    // Usar captura pasiva para no afectar rendimiento de scroll/click
    document.addEventListener("click", handleClick, { capture: true, passive: true });
    document.addEventListener("touchstart", handleClick, { capture: true, passive: true });

    const cleanup = () => {
      document.removeEventListener("click", handleClick, { capture: true });
      document.removeEventListener("touchstart", handleClick, { capture: true });
    };

    return cleanup;
  }, []);

  return null;
}
