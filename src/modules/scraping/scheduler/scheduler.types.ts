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
  /** Fuente objetivo que entrará al pipeline */
  source: any; // Se reemplazará con el modelo Source en ingest-sources.ts
  /** Modo predictivo seleccionado por la heurística */
  mode: Mode;
  /** Cantidad estimada de URLs a descubrir (si aplica) */
  maxUrls: number;
  /** Profundidad estimada en costos de LLM */
  estimatedCost: number;
}
