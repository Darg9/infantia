export type Mode = 'DEEP' | 'SURFACE' | 'PING' | 'PARSE_ONLY';

export interface SourceStats {
  /** Source URL hostname (sin www) o alias de BD */
  sourceId: string;
  /** CTR real calculado (clicks / views) en los últimos 7 días */
  ctr7d: number;
  /** Promedio histórico de actividades guardadas / URLs descubiertas en % */
  saveRate: number;
  /** Health score actual de la base de datos (0-1) */
  health: number;
  /** Promedio de llamadas consumidas (Gemini tokens/costs) en las últimas 5 corridas */
  avgCost: number;
  /** Cantidad de URLs de la fuente en cache marcadas con needsReparse */
  reparseCount: number;
  /** Indica si la URL pertenece a dependencias gubernamentales (isGov = true) */
  isGov: boolean;
}

export interface SchedulePlan {
  /** Fuente objetivo que entrará al pipeline (modelo ScrapingSource serializado) */
  source: {
    id: string;
    name: string;
    url: string;
    platform: string;
    config?: Record<string, unknown> | null;
    city?: { name: string } | null;
    vertical?: { slug: string } | null;
    [key: string]: unknown; // permite campos extra sin romper narrowing
  };
  /** Modo predictivo seleccionado por la heurística (DEEP/SURFACE/PING para discovery) */
  mode: Mode;
  /** Cantidad de URLs a descubrir (capped por presupuesto disponible) */
  maxUrls: number;
  /** Profundidad estimada en costos de LLM (discovery + reparse combinados) */
  estimatedCost: number;
  /**
   * v2: Cantidad de URLs con needsReparse a procesar DESPUÉS del discovery.
   * undefined / 0 = sin deuda de reparse en este run.
   *
   * Cambio clave respecto a v1:
   * - v1: reparseCount > 0 → modo PARSE_ONLY → discovery desactivado completamente
   * - v2: reparseCount > 0 → discovery ocurre normalmente + reparse se ejecuta al final
   *       El resultado: nunca se pierde contenido nuevo por tener deuda de reparse.
   */
  reparseCount?: number; // undefined = 0 (backward-compat con v1)
}
