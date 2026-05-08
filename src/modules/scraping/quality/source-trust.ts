// =============================================================================
// Source Trust — Pipeline V2
//
// Lee y actualiza el trust score por fuente desde la tabla source_learning.
// El score se ajusta tras cada decisión editorial en el panel admin.
//
// Fórmula: trust_score = approved / (approved + rejected)
// Threshold dinámico:
//   trust_score >= 0.80 → threshold = 0.30 (fuente muy confiable)
//   trust_score >= 0.60 → threshold = 0.35
//   default             → threshold = 0.40
//
// IMPORTANTE: El trust score solo ajusta thresholds cuando la fuente tiene
// >= MIN_DECISIONS decisiones. Antes de eso, usa valores por defecto.
// =============================================================================

import { prisma } from '../../../lib/db';
import { isInstitutionalSource } from '../../../config/institutional-whitelist';

const MIN_DECISIONS = 3; // mínimo de decisiones antes de ajustar threshold

export interface SourceTrustRecord {
  source: string;
  isInstitutional: boolean;
  approved: number;
  rejected: number;
  trustScore: number;   // 0.0 – 1.0
  threshold: number;    // umbral de gate efectivo
  hasEnoughData: boolean;
}

const DEFAULT_TRUST: SourceTrustRecord = {
  source: 'unknown',
  isInstitutional: false,
  approved: 0,
  rejected: 0,
  trustScore: 0.5,
  threshold: 0.40,
  hasEnoughData: false,
};

/**
 * Obtiene el trust score de una fuente desde source_learning.
 * Si no existe → crea el registro con valores por defecto.
 */
export async function getSourceTrust(sourceUrl: string): Promise<SourceTrustRecord> {
  let domain = 'unknown';
  try {
    domain = new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch { /* url inválida */ }

  const isInstitutional = isInstitutionalSource(sourceUrl);

  try {
    // Upsert: si no existe, crea con valores por defecto
    type RawRow = { source: string; is_institutional: boolean; approved: number; rejected: number; trust_score: number; threshold: number };
    const rows = await prisma.$queryRawUnsafe<RawRow[]>(
      `INSERT INTO source_learning (source, is_institutional, approved, rejected, trust_score, threshold)
       VALUES ($1, $2, 0, 0, 0.5, 0.40)
       ON CONFLICT (source) DO UPDATE SET last_updated = now()
       RETURNING source, is_institutional, approved, rejected, trust_score, threshold`,
      domain, isInstitutional,
    );

    const row = rows[0];
    if (!row) return { ...DEFAULT_TRUST, source: domain, isInstitutional };

    const total = row.approved + row.rejected;
    const hasEnoughData = total >= MIN_DECISIONS;

    // Threshold dinámico basado en trust score (solo si hay datos suficientes)
    let threshold = 0.40;
    if (hasEnoughData) {
      if (row.trust_score >= 0.80) threshold = 0.30;
      else if (row.trust_score >= 0.60) threshold = 0.35;
      else threshold = 0.40;
    }

    return {
      source: row.source,
      isInstitutional: row.is_institutional,
      approved: row.approved,
      rejected: row.rejected,
      trustScore: row.trust_score,
      threshold,
      hasEnoughData,
    };
  } catch {
    return { ...DEFAULT_TRUST, source: domain, isInstitutional };
  }
}

/**
 * Registra una decisión editorial y actualiza el trust score.
 * Llamado desde el panel admin cuando Denys aprueba o rechaza.
 */
export async function recordSourceDecision(
  source: string,
  decision: 'approved' | 'rejected',
): Promise<void> {
  try {
    const field = decision === 'approved' ? 'approved' : 'rejected';
    await prisma.$executeRawUnsafe(
      `UPDATE source_learning
       SET ${field} = ${field} + 1,
           trust_score = CASE
             WHEN (approved + rejected + 1) >= $1
             THEN (CASE WHEN $2 = 'approved' THEN approved + 1 ELSE approved END)::float
                  / (approved + rejected + 1)::float
             ELSE trust_score
           END,
           last_updated = now()
       WHERE source = $3`,
      MIN_DECISIONS,
      decision,
      source,
    );
  } catch {
    // Best-effort — nunca bloquear
  }
}
