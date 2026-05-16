// In-memory Anti-Spam (Throttle) temporal cache
const lastEventMap = new Map<string, number>();

// Analytics Sampling Rate Config
// Leído del entorno global en cliente o fallback a 1.0 (100%)
const getSampleRate = () => {
  if (typeof window !== 'undefined' && (window as any).ANALYTICS_SAMPLE_RATE !== undefined) {
    return Number((window as any).ANALYTICS_SAMPLE_RATE) || 1.0;
  }
  return 1.0; // En producción V3 se podrá ajustar desde un <script> global si es necesario
};

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

  } catch {
    // fail silently para no afectar performance UX ni crashear arbol de render...
  }
}

// ============================================================================
// Discovery Observability Layer (Fase 1) - Batch Tracker
// ============================================================================

class EventBatchTracker {
  private queue: Array<{ activityId: string; metadata?: any }> = [];
  private sessionSeen = new Set<string>();
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL = 5000; // 5 segundos

  constructor() {
    if (typeof window !== 'undefined') {
      // Flush on navigation/close
      window.addEventListener('beforeunload', () => this.flush(true));
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flush(true);
      });
    }
  }

  public trackFeedImpression(activityId: string, context?: any) {
    // 1. Sampling Rate
    if (Math.random() > getSampleRate()) return;

    // 2. Session Deduplication
    if (this.sessionSeen.has(activityId)) return;
    this.sessionSeen.add(activityId);

    // 3. Queue Event
    this.queue.push({ activityId, metadata: context });

    // 4. Schedule Flush
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL);
    }
  }

  private flush(isUnload = false) {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0) return;

    const payload = {
      type: 'feed_impression_batch',
      metadata: {
        items: [...this.queue],
        // Extraemos contexto global (ej. sort, query) del primer item si lo hay, para no repetir
        context: this.queue[0]?.metadata || {}
      }
    };

    // Vaciamos cola
    this.queue = [];

    const url = '/api/events';
    const body = JSON.stringify(payload);

    try {
      if (isUnload && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        // En desmontaje, sendBeacon es más confiable que fetch
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } else {
        // En runtime, fetch con keepalive para no bloquear
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body
        }).catch(() => {});
      }
    } catch {
      // fail silently
    }
  }
}

export const batchTracker = new EventBatchTracker();

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

/**
 * Evento para registrar cuando una búsqueda o filtro no arroja resultados.
 * Fundamental para detectar brechas en el catálogo.
 */
export function trackZeroResults({
  query,
  filters,
  cityId,
  path
}: {
  query?: string;
  filters?: Record<string, string>;
  cityId?: string;
  path?: string;
}) {
  void trackEvent({
    type: 'zero_results',
    path,
    metadata: { query: query || null, filters: filters || null, cityId: cityId || null }
  });
}
