// =============================================================================
// city-review.ts — Cola de revisión para ciudades de baja confianza
//
// Cuando matchCity() retorna REVIEW o NEW, se encola la entrada para
// revisión humana en la tabla city_review_queue.
//
// Fire-and-forget: nunca bloquea el pipeline.
// Migración DDL: scripts/migrate-city-review-queue.ts
// =============================================================================

import { createLogger } from '../../lib/logger';

const log = createLogger('geo:city-review');

// Lazy singleton para no importar prisma en tests que no lo necesiten
let _prisma: import('@prisma/client').PrismaClient | null = null;

function getPrisma() {
  if (!_prisma) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('@prisma/client') as typeof import('@prisma/client');
    _prisma = new PrismaClient();
  }
  return _prisma;
}

/** @internal — solo para tests */
export function _resetCityReviewPrismaForTests(): void {
  _prisma = null;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CityReviewEntry {
  rawInput:        string;
  normalizedInput: string;
  suggestedCityId: string | null;
  similarityScore: number;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Encola una ciudad no resuelta para revisión humana.
 * Fire-and-forget — no bloquea el pipeline.
 */
export function queueCityReview(entry: CityReviewEntry): void {
  void (async () => {
    try {
      const db = getPrisma();
      await (db as any).$executeRaw`
        INSERT INTO "city_review_queue"
          ("raw_input", "normalized_input", "suggested_city_id", "similarity_score")
        VALUES
          (${entry.rawInput}, ${entry.normalizedInput}, ${entry.suggestedCityId}, ${entry.similarityScore})
      `;
    } catch (err: unknown) {
      // Non-fatal — no rompe el pipeline
      log.warn('[city-review] Error encolando revisión (non-fatal)', {
        rawInput: entry.rawInput,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}
