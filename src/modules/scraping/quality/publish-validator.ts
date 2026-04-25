import { ActivityNLPResult } from '../types';
import { isDomainSpecificNoise } from './domain-noise-rules';
import { createLogger } from '../../../lib/logger';

const log = createLogger('scraping:trust-layer');

export interface PublishValidationResult {
  action: 'PUBLISH' | 'QUARANTINE' | 'REJECT';
  reason: string;
  // 'QUARANTINE' maps to ActivityStatus.PAUSED — reversible, not public
  // 'REJECT' maps to DISCARDED_QUALITY — not persisted
  // 'PUBLISH' maps to ActivityStatus.ACTIVE
}

const DEFAULT_PAST_TOLERANCE_DAYS = 3;
const DOMAIN_PAST_TOLERANCE: Record<string, number> = {
  'cinematecadebogota.gov.co': 7,
  'idartes.gov.co': 14,
  'banrepcultural.org': 14,
  'museonacional.gov.co': 14,
};

export function validateForPublish(
  activity: ActivityNLPResult,
  sourceUrl: string
): PublishValidationResult {
  const title = activity.title || '';
  const startDate = activity.schedules?.[0]?.startDate ? new Date(activity.schedules[0].startDate) : null;
  const confidence = activity.confidenceScore ?? 0;
  
  let hostname = '';
  try { hostname = new URL(sourceUrl).hostname.replace('www.', ''); } catch { /* ignore */ }

  // ── 1. HARD REJECTS (Basura clara) ──

  // A. Ruido Corporativo (PQRS, /producto/, etc)
  if (isDomainSpecificNoise(sourceUrl, title)) {
    return { action: 'REJECT', reason: 'domain_noise_or_global_keyword' };
  }

  // B. Fechas alucinadas (Ej: > 540 días en el futuro)
  if (startDate) {
    const maxFutureDate = new Date();
    maxFutureDate.setDate(maxFutureDate.getDate() + 540);
    if (startDate > maxFutureDate) {
      return { action: 'REJECT', reason: 'future_date_hallucination' };
    }
  }

  // C. Empty content reject (título corto + sin descripción + sin fecha)
  if (title.length < 15 && !activity.description && !startDate) {
    return { action: 'REJECT', reason: 'empty_content' };
  }

  // ── 2. QUARANTINE (Duda razonable -> guardar como PAUSED) ──

  // D. Evento Expirado (pasó hace más de X días)
  if (startDate) {
    // Si hace match con dominios o subdominios
    const matchedDomain = Object.keys(DOMAIN_PAST_TOLERANCE).find(
      domain => hostname === domain || hostname.endsWith(`.${domain}`)
    );
    const tolerance = matchedDomain ? DOMAIN_PAST_TOLERANCE[matchedDomain] : DEFAULT_PAST_TOLERANCE_DAYS;
    
    const pastToleranceDate = new Date();
    pastToleranceDate.setDate(pastToleranceDate.getDate() - tolerance);
    pastToleranceDate.setHours(0, 0, 0, 0);
    
    const startWithoutTime = new Date(startDate);
    startWithoutTime.setHours(0, 0, 0, 0);

    if (startWithoutTime < pastToleranceDate) {
      // Hard reject para cosas exageradamente viejas (ej: evento 2024 insertado en 2026) -> 180 días max
      const extremePastDate = new Date();
      extremePastDate.setDate(extremePastDate.getDate() - 180);
      if (startWithoutTime < extremePastDate) {
         return { action: 'REJECT', reason: 'extreme_past_date' };
      }
      return { action: 'QUARANTINE', reason: `past_date_soft_${tolerance}d` };
    }
  }

  // E. Sin fecha
  if (!startDate) {
    if (confidence < 0.65) {
      return { action: 'QUARANTINE', reason: 'missing_date_low_confidence' };
    } else {
      // Sin fecha pero alta confianza (puede ser exposición permanente o campaña)
      return { action: 'QUARANTINE', reason: 'missing_date_high_confidence' };
    }
  }

  // F. Score medio
  if (confidence < 0.4) {
    return { action: 'QUARANTINE', reason: 'medium_score' };
  }

  // ── 3. PUBLISH (Todo sólido) ──
  return { action: 'PUBLISH', reason: 'ok' };
}
