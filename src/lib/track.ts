// In-memory Anti-Spam (Throttle) temporal cache
const lastEventMap = new Map<string, number>();

function shouldTrack(key: string, delay: number) {
  const now = Date.now();
  const last = lastEventMap.get(key);

  if (last && now - last < delay) {
    return false;
  }

  // Update in throttle registry
  lastEventMap.set(key, now);
  
  // Limpiar llaves residuales para evitar Mem-leak si la sesion es muy prolongada (opcional pero util en SPA)
  if (lastEventMap.size > 500) lastEventMap.clear();

  return true;
}

export async function trackEvent({
  type,
  activityId,
  path,
  metadata
}: {
  type: string;
  activityId?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    let delay = 0;

    if (type === "activity_click") delay = 500;
    if (type === "outbound_click") delay = 1000;
    // filter_applied: throttle por combinación tipo+valor para evitar doble disparo en cambios rápidos
    if (type === "filter_applied") delay = 2000;

    const filterTypeStr = type === 'filter_applied' && metadata?.filterType ? `:${metadata.filterType}` : '';
    const key = `${type}${filterTypeStr}:${activityId || path || "global"}`;

    if (delay > 0 && !shouldTrack(key, delay)) {
      return; // Bloqueo temporal Anti-Spam Throttled
    }

    await fetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      // Habilitar keepalive para asegurar envio al cambiar de ruta
      keepalive: true, 
      body: JSON.stringify({
        type,
        activityId,
        path,
        metadata
      })
    });

  } catch (e) {
    // fail silently para no afectar performance UX ni crashear arbol de render...
    // console.warn('Silenced Event Error');
  }
}

/**
 * Evento semántico para interacciones con filtros facetados.
 * Se dispara UNA vez por filtro activo tras confirmar el cambio (post-navegación, no en debounce).
 *
 * Permite responder:
 * - ¿Qué filtros generan más valor?
 * - ¿Los filtros corroboran o contradicen la intención de búsqueda?
 * - ¿Qué combinación filtro+búsqueda produce mayor descubrimiento?
 */
export function trackFilterApplied({
  filterType,
  filterValue,
  resultsCount,
  query,
  path,
}: {
  /** 'category' | 'city' | 'price' | 'age' | 'type' | 'audience' | 'sort' */
  filterType: string;
  /** Valor legible del filtro (label o enum) — nunca UUID crudo */
  filterValue: string;
  /** Conteo de resultados DESPUÉS de aplicar el filtro (post-SSR) */
  resultsCount: number;
  /** Búsqueda de texto activa en ese momento, si la hay */
  query?: string;
  /** Ruta actual para contextualización */
  path?: string;
}) {
  // No trackear limpiezas de filtro ni valores vacíos — el reset es un evento implícito
  if (!filterValue) return;

  void trackEvent({
    type: 'filter_applied',
    path,
    metadata: { filterType, filterValue, resultsCount, query: query || null },
  });
}
