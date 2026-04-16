// =============================================================================
// preflight-db.ts — Persistencia asíncrona de resultados Date Preflight
//
// Inserta una fila en date_preflight_logs por cada URL evaluada.
// La llamada es fire-and-forget: los errores se logean pero no bloquean el pipeline.
//
// Vocabulario de reason (alineado con PreflightReason de date-preflight.ts):
//   process        → URL enviada a Gemini  (equivale a "ok" en la propuesta)
//   datetime_past  → descartada por atributo datetime HTML   (capa 1)
//   text_date_past → descartada por fecha en texto plano     (capa 2)
//   past_year_only → descartada por años pasados sin actual  (capa 3a)
//   keyword_past   → descartada por keyword de evento final  (capa 3b)
//
// used_fallback = true  → se usó capa 2 o 3 (menos precisa que capa 1)
// used_fallback = false → capa 1 (datetime atributo) o sin señal detectada
// =============================================================================

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client';
import { createLogger } from '../../../lib/logger';
import { PreflightResult } from './date-preflight';

const log = createLogger('scraping:preflight-db');

// Singleton lazy para no crear conexión si el módulo no se usa
let _prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!_prisma) {
    const connectionString = process.env.DATABASE_URL ?? '';
    const adapter = new PrismaPg({ connectionString });
    _prisma = new PrismaClient({ adapter });
  }
  return _prisma;
}

/** Solo para tests — resetea el singleton entre casos de prueba. */
export function _resetPrismaForTests(): void {
  _prisma = null;
}

export interface PreflightLogEntry {
  sourceId?: string | null;
  url: string;
  result: PreflightResult;
  /** Primera fecha parseada (si se encontró alguna) */
  parsedDate?: Date | null;
}

/**
 * Persiste el resultado de un preflight en date_preflight_logs.
 * Fire-and-forget: no lanza excepción al caller.
 */
export async function savePreflightLog(entry: PreflightLogEntry): Promise<void> {
  const { sourceId, url, result, parsedDate } = entry;
  const usedFallback = result.reason !== 'datetime_past' && result.reason !== 'process';

  try {
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(
      `INSERT INTO date_preflight_logs
         (source_id, url, raw_date_text, parsed_date, reason, used_fallback, skip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      sourceId ?? null,
      url,
      result.matchedText ?? null,
      parsedDate ?? null,
      result.reason,
      usedFallback,
      result.skip,
    );
  } catch (err: unknown) {
    // No propagamos — el pipeline no debe fallar por un log
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('[PREFLIGHT-DB] Error guardando log (non-fatal)', { url, error: msg });
  }
}

/**
 * Queries de métricas — leer los resultados directamente en Supabase o con psql.
 *
 * Skip rate total (últimos 7 días):
 *   SELECT COUNT(*) FILTER (WHERE skip = true)::numeric / COUNT(*) AS skip_rate
 *   FROM date_preflight_logs WHERE created_at >= now() - interval '7 days';
 *
 * Distribución por reason:
 *   SELECT reason, COUNT(*) * 1.0 / SUM(COUNT(*)) OVER() AS pct
 *   FROM date_preflight_logs
 *   WHERE created_at >= now() - interval '7 days'
 *   GROUP BY reason ORDER BY pct DESC;
 *
 * Fallback rate:
 *   SELECT COUNT(*) FILTER (WHERE used_fallback)::numeric / COUNT(*) AS fallback_rate
 *   FROM date_preflight_logs WHERE created_at >= now() - interval '7 days';
 *
 * Dataset para falsos negativos (muestra manual):
 *   SELECT url, raw_date_text FROM date_preflight_logs
 *   WHERE skip = true
 *   ORDER BY random() LIMIT 30;
 *
 * Limpieza (TTL 14 días):
 *   DELETE FROM date_preflight_logs WHERE created_at < now() - interval '14 days';
 */
