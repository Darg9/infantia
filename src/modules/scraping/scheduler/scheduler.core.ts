import { Mode, SourceStats, SchedulePlan } from './scheduler.types';
import { createLogger } from '../../../lib/logger';

const log = createLogger('scraping:scheduler');

export const DEPTH: Record<Mode, { maxUrls: number }> = {
  DEEP: { maxUrls: 40 },
  SURFACE: { maxUrls: 15 },
  PING: { maxUrls: 5 },
  PARSE_ONLY: { maxUrls: Infinity },
};

/**
 * Selecciona el modo de extracción para una fuente basada en histórico.
 */
export function pickMode(s: SourceStats): Mode {
  if (s.reparseCount > 0) return 'PARSE_ONLY';

  // Penalización a fuentes devoradoras de cuota sin retorno
  if (s.avgCost > 80 && s.saveRate < 0.1) {
    return 'SURFACE';
  }

  // Boost de eficiencia a fuentes orgánicamente limpias
  if (s.saveRate > 0.3 && s.avgCost < 30) {
    return 'DEEP';
  }

  // Conversión pura probada por usuarios
  if (s.ctr7d >= 0.20 && s.health >= 0.7) return 'DEEP';

  // Fuentes problemáticas o restrictivas (Gov) mitigadas a PING
  if (s.health < 0.4 || s.saveRate < 0.05 || s.isGov) return 'PING';

  return 'SURFACE';
}

/**
 * Estima el costo (calls / Gemini) según el modo y límite.
 */
export function estimateCost(maxUrls: number, mode: Mode, reparseCount: number = 0): number {
  if (mode === 'PARSE_ONLY') {
    // 1 token por reparse (pipeline sin discovery)
    return reparseCount * 1;
  }
  
  // Para operaciones con discovery, estimamos 1 llamada para discovery y 0.5 llamada para filter pre-flight parse
  return maxUrls * 1.5;
}

export interface PlanResult {
  planned: SchedulePlan[];
  skipped: { source: any; mode: Mode; reason: string }[];
  budgetUsed: number;
  budgetWasted?: number;
}

/**
 * Resuelve la estrategia de extracción dada una lista de fuentes y el presupuesto diario de Gemini disponibles.
 */
export function buildPredictivePlan(
  sources: { source: any; stats: SourceStats }[],
  totalBudget: number
): PlanResult {
  const plan: SchedulePlan[] = [];
  const skipped: PlanResult['skipped'] = [];

  let budgetRemaining = totalBudget;
  const maxBudgetPerSource = 0.25 * totalBudget;
  const maxReparseBudget = 0.3 * totalBudget;
  let reparseBudgetUsed = 0;

  // Optimización de orden: la prioridad dicta en qué se gasta primero el presupuesto de Gemini (importante si la cuota es escasa).
  // 1. PARSE_ONLY (Recuperar la deuda que bajó el score del source)
  // 2. DEEP (Conversión real, nos pagan indirectamente por esto)
  // 3. SURFACE (Mantener fresco lo normal)
  // 4. PING (Ver si volvieron los zombies)
  const modePriority = { PARSE_ONLY: 1, DEEP: 2, SURFACE: 3, PING: 4 };

  // Copia modificable para iterar segura, asumiendo sources con estadísticas listadas.
  const ordered = [...sources].sort((a, b) => {
    const aMode = pickMode(a.stats);
    const bMode = pickMode(b.stats);
    return modePriority[aMode] - modePriority[bMode];
  });

  for (const item of ordered) {
    const { source, stats } = item;
    const mode = pickMode(stats);
    let maxUrls = DEPTH[mode].maxUrls;
    
    if (mode === 'PARSE_ONLY') {
      maxUrls = stats.reparseCount;
    }
    
    const cost = estimateCost(maxUrls, mode, stats.reparseCount);

    if (cost > budgetRemaining) {
      skipped.push({ source, mode, reason: `Excede budget local (req: ${cost}, rem: ${budgetRemaining})` });
      continue;
    }

    if (cost > maxBudgetPerSource && mode !== 'PARSE_ONLY') {
      // Degradar modo si excede su capa máxima y no es una recuperación nativa de parse
      // (ej. un DEEP muy ambicioso en fuente carísima).
      skipped.push({ source, mode, reason: `Excede maxBudgetPerSource 25% (req: ${cost})` });
      continue; 
    }

    if (mode === 'PARSE_ONLY') {
       if ((reparseBudgetUsed + cost) > maxReparseBudget) {
         skipped.push({ source, mode, reason: `Excede bucket maxReparseBudget 30%` });
         continue;
       }
       reparseBudgetUsed += cost;
    }

    plan.push({
      source,
      mode,
      maxUrls,
      estimatedCost: cost
    });
    budgetRemaining -= cost;
  }

  log.info(`Plan generado: ${plan.length} fuentes, Presupuesto consumido estimado: ${totalBudget - budgetRemaining} / ${totalBudget}`);

  return {
    planned: plan,
    skipped,
    budgetUsed: totalBudget - budgetRemaining
  };
}
