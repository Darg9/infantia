/**
 * scheduler.core.ts — v2
 *
 * Cambio principal respecto a v1:
 *   v1: reparseCount > 0 → PARSE_ONLY → discovery DESACTIVADO
 *       Consecuencia: fuentes con deuda de reparse nunca descubrían contenido nuevo
 *       (detectado con audit-coverage.ts el 2026-04-30: Idartes perdía 11 URLs nuevas,
 *        Sec. Cultura perdía 15).
 *
 *   v2: PARSE_ONLY ya no se auto-asigna por deuda de reparse.
 *       Discovery SIEMPRE ocurre. El reparse se ejecuta como una fase adicional
 *       al final del run, controlado por el campo `reparseCount` en SchedulePlan.
 *       Budget = discovery_cost + reparse_cost (combinado, capped a 20 URLs de reparse).
 *
 * Archivos de referencia:
 *   Backup v1: scheduler.core.v1.ts / scheduler.types.v1.ts
 */
import { Mode, SourceStats, SchedulePlan } from './scheduler.types';
import { createLogger } from '../../../lib/logger';

const log = createLogger('scraping:scheduler');

export const DEPTH: Record<Mode, { maxUrls: number }> = {
  DEEP:       { maxUrls: 40 },
  SURFACE:    { maxUrls: 15 },
  PING:       { maxUrls: 5  },
  PARSE_ONLY: { maxUrls: Infinity }, // Reservado para uso manual / backward-compat
};

/** Máximo de URLs de reparse a procesar por fuente por run (evita que reparse devore budget) */
const MAX_REPARSE_PER_RUN = 20;

/**
 * v2: Selecciona el modo de DISCOVERY para una fuente.
 *
 * PARSE_ONLY ya NO se retorna automáticamente cuando hay reparseCount.
 * El reparse ocurre como fase adicional independientemente del modo de discovery.
 */
export function pickMode(s: SourceStats): Mode {
  // Penalización a fuentes devoradoras de cuota sin retorno
  if (s.avgCost > 80 && s.saveRate < 0.1) return 'SURFACE';

  // Boost de eficiencia a fuentes orgánicamente limpias
  if (s.saveRate > 0.3 && s.avgCost < 30) return 'DEEP';

  // Conversión pura probada por usuarios
  if (s.ctr7d >= 0.20 && s.health >= 0.7) return 'DEEP';

  // Fuentes problemáticas → PING (solo exploración mínima)
  if (s.health < 0.4 || s.saveRate < 0.05) return 'PING';

  return 'SURFACE';
}

/**
 * Estima el costo combinado (discovery + reparse) para presupuesto de Gemini.
 *
 * Discovery: maxUrls * 1.5 (1 llamada discovery + 0.5 preflight por URL)
 * Reparse:   min(reparseCount, MAX_REPARSE_PER_RUN) * 1 (1 llamada por URL)
 */
export function estimateCost(maxUrls: number, mode: Mode, reparseCount: number = 0): number {
  if (mode === 'PARSE_ONLY') {
    // Backward-compat: PARSE_ONLY puro (sin discovery) solo cuenta reparse
    return Math.min(reparseCount, MAX_REPARSE_PER_RUN) * 1;
  }
  const discoveryCost = maxUrls * 1.5;
  const reparseCost   = Math.min(reparseCount, MAX_REPARSE_PER_RUN) * 1;
  return discoveryCost + reparseCost;
}

export interface PlanResult {
  planned: SchedulePlan[];
  skipped: { source: any; mode: Mode; reason: string }[];
  budgetUsed: number;
}

/**
 * v2: Resuelve la estrategia de extracción para una lista de fuentes.
 *
 * Orden de prioridad (dicta en qué se gasta primero el presupuesto):
 *   1. DEEP   — fuentes de alto rendimiento probado
 *   2. SURFACE — mantenimiento estándar
 *   3. PING   — exploración mínima / fuentes problemáticas
 *
 * El reparse ya no tiene prioridad propia: va montado sobre el modo de discovery
 * como costo adicional. Si no hay budget para el reparse, se hace discovery solo.
 */
export function buildPredictivePlan(
  sources: { source: any; stats: SourceStats }[],
  totalBudget: number
): PlanResult {
  const plan: SchedulePlan[] = [];
  const skipped: PlanResult['skipped'] = [];

  let budgetRemaining = totalBudget;
  const maxBudgetPerSource = 0.25 * totalBudget;

  // Prioridad de discovery: DEEP primero (mayor valor), luego SURFACE, luego PING
  const modePriority: Record<Mode, number> = { DEEP: 1, SURFACE: 2, PING: 3, PARSE_ONLY: 4 };

  const ordered = [...sources].sort((a, b) => {
    const aMode = pickMode(a.stats);
    const bMode = pickMode(b.stats);
    return modePriority[aMode] - modePriority[bMode];
  });

  for (const item of ordered) {
    const { source, stats } = item;
    const mode    = pickMode(stats);
    const maxUrls = DEPTH[mode].maxUrls;

    // Calcular reparse capped para esta fuente
    const reparseCount = Math.min(stats.reparseCount, MAX_REPARSE_PER_RUN);

    // Costo combinado discovery + reparse
    const fullCost = estimateCost(maxUrls, mode, stats.reparseCount);

    if (fullCost > budgetRemaining) {
      // Intentar sin reparse si discovery solo cabe
      const discoverOnlyCost = maxUrls * 1.5;
      if (discoverOnlyCost <= budgetRemaining) {
        // Discovery sin reparse: preferible a saltarse la fuente
        plan.push({ source, mode, maxUrls, estimatedCost: discoverOnlyCost, reparseCount: 0 });
        budgetRemaining -= discoverOnlyCost;
        log.info(`[PLAN] ${source.name}: reparse omitido por budget (discovery_only=${discoverOnlyCost})`);
      } else {
        skipped.push({ source, mode, reason: `Excede budget (req: ${fullCost}, rem: ${budgetRemaining})` });
      }
      continue;
    }

    if (fullCost > maxBudgetPerSource) {
      skipped.push({ source, mode, reason: `Excede maxBudgetPerSource 25% (req: ${fullCost})` });
      continue;
    }

    plan.push({ source, mode, maxUrls, estimatedCost: fullCost, reparseCount });
    budgetRemaining -= fullCost;
  }

  log.info(
    `Plan generado: ${plan.length} fuentes, ` +
    `Presupuesto consumido estimado: ${totalBudget - budgetRemaining} / ${totalBudget}`
  );

  return {
    planned: plan,
    skipped,
    budgetUsed: totalBudget - budgetRemaining,
  };
}
