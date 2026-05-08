// =============================================================================
// Activity Gate V2 — Pipeline V2 (paralelo al V1, sin modificar V1)
//
// Diferencias clave vs V1 (activity-gate.ts):
//   1. Retorna 'ACTIVE' | 'PENDING_REVIEW' | 'DROP' en vez de pass/fail binario
//   2. Umbral diferenciado: institucionales más permisivos que fuentes desconocidas
//   3. Trust score dinámico por fuente (desde source_learning en BD)
//   4. Nunca hace DROP de fuentes institucionales salvo isActivity:false explícito
//
// Filosofía:
//   Recall > Precision — perder una actividad real es peor que revisar una dudosa.
//   El panel admin es el safety net, no el gate.
// =============================================================================

import type { ActivityNLPResult } from '../types';
import { isInstitutionalSource } from '../../../config/institutional-whitelist';

export type GateV2Decision = 'ACTIVE' | 'PENDING_REVIEW' | 'DROP';

export interface GateV2Result {
  decision: GateV2Decision;
  score: number;           // 0.0 – 1.0
  reason: string;          // motivo legible
  isInstitutional: boolean;
  sourceTrust: number;     // trust score de la fuente (0.0 – 1.0)
  signals: {
    hasIntentSignal: boolean;
    hasTimeSignal: boolean;
    hasLocationSignal: boolean;
    noiseDetected: boolean;
    blockedBySourcePath: boolean;
  };
}

// ─── Thresholds ──────────────────────────────────────────────────────────────

// Fuentes institucionales: umbral más bajo (más permisivas)
const INSTITUTIONAL_ACTIVE_THRESHOLD    = 0.40;
const INSTITUTIONAL_REVIEW_THRESHOLD    = 0.10; // por debajo → PENDING_REVIEW (nunca DROP)

// Fuentes no institucionales: umbrales más estrictos
const OTHER_ACTIVE_THRESHOLD            = 0.45;
const OTHER_REVIEW_THRESHOLD            = 0.20; // por debajo → DROP

// ─── Keywords (heredados de V1 + ampliados) ───────────────────────────────────
const INTENT_KEYWORDS = [
  'taller', 'workshop', 'evento', 'inscripción', 'inscripcion',
  'función', 'funcion', 'clases', 'clase', 'agenda', 'programación',
  'programacion', 'concierto', 'exposición', 'exposicion', 'festival',
  'feria', 'campamento', 'visita', 'tour', 'laboratorio', 'charla',
  'conferencia', 'encuentro', 'performance', 'obra', 'show',
  'actividad', 'curso', 'ciclo', 'temporada', 'lanzamiento',
  'inauguración', 'inauguracion', 'recorrido', 'proyección', 'proyeccion',
  'presentación', 'presentacion', 'conversatorio', 'simposio', 'foro',
];

const TIME_KEYWORDS: (string | RegExp)[] = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,
  /\d{4}-\d{2}-\d{2}/,
  'hoy', 'mañana', 'manana', 'próximo', 'proximo', 'próxima', 'proxima',
  /\d{1,2}:\d{2}/,
  'am', 'pm', 'hora', 'horas',
  'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo',
  'semanal', 'diario', 'mensual',
];

const NOISE_KEYWORDS = [
  'noticia', 'noticias', 'comunicado', 'balance', 'informe',
  'gestión pública', 'gestion publica', 'directorio institucional',
  'organigrama', 'plan estratégico', 'plan estrategico',
  'tratamiento de datos', 'términos y condiciones', 'terminos y condiciones',
  'política de privacidad', 'politica de privacidad',
  'subsidiarias', 'portafolio de servicios', 'distribuidora',
  'cómo publicar', 'como publicar', 'pqrs', 'áreas disponibles',
  'areas disponibles', 'quiénes somos', 'quienes somos',
  'iniciar sesión', 'iniciar sesion', 'captcha', 'bot manager',
  'web awards', 'logra premio', 'boletines', 'librería del mes',
  'comprar libros', 'mi cuenta', 'tienda-librería',
];

const NOISE_URL_FRAGMENTS = [
  '/nosotros', '/escuelas-leo', '/escenarios-moviles', '/mas-cultura-local',
  '/explora-el-jardin', '/recursos-educativos', '/reservas', '/buscador',
  '/participacion', '/sondeos', '/home-cinemateca', '/visita-cinemateca',
  '/institucional',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function matchesAny(text: string, patterns: (string | RegExp)[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some((p) =>
    typeof p === 'string' ? lower.includes(p.toLowerCase()) : p.test(text),
  );
}

// ─── Evaluación principal ────────────────────────────────────────────────────

/**
 * Evalúa si un resultado NLP debe publicarse, encolarse para revisión o descartarse.
 *
 * @param data          Resultado del NLP (Gemini)
 * @param sourceUrl     URL de origen
 * @param sourceTrust   Trust score de la fuente (0.0–1.0, default 0.5)
 *                      Si la fuente tiene < 3 decisiones en source_learning,
 *                      pasar 0.5 (sin ajuste).
 */
export function evaluateActivityGateV2(
  data: ActivityNLPResult,
  sourceUrl: string,
  sourceTrust: number = 0.5,
): GateV2Result {
  const isInstitutional = isInstitutionalSource(sourceUrl);
  const fullText = `${data.title} ${data.description ?? ''}`.toLowerCase();

  // ── Señales ──────────────────────────────────────────────────────────────
  const hasIntentSignal    = matchesAny(fullText, INTENT_KEYWORDS);
  const hasSchedules       = !!(data.schedules && data.schedules.length > 0);
  const hasTimeSignal      = hasSchedules || matchesAny(fullText, TIME_KEYWORDS);
  const hasLocationSignal  = matchesAny(fullText, [
    'bogotá', 'bogota', 'medellín', 'medellin', 'cali', 'cartagena',
    'presencial', 'virtual', 'online', 'en vivo', 'auditorio', 'sede',
    'sala', 'teatro', 'parque', 'biblioteca', 'museo', 'centro',
  ]);
  const noiseDetected      = matchesAny(fullText, NOISE_KEYWORDS) ||
                             matchesAny(sourceUrl, NOISE_URL_FRAGMENTS);
  const blockedBySourcePath = false; // V2 no bloquea por path — el ranking lo maneja

  const signals = { hasIntentSignal, hasTimeSignal, hasLocationSignal, noiseDetected, blockedBySourcePath };

  // ── Score base ───────────────────────────────────────────────────────────
  let score = 0;
  if (hasIntentSignal)   score += 0.25;
  if (hasTimeSignal)     score += 0.30;
  if (hasLocationSignal) score += 0.15;
  score += data.confidenceScore * 0.30;  // señal Gemini
  if (noiseDetected)     score -= 0.35;  // más suave que V1 (era -0.40)

  // Ajuste por trust score de la fuente (±0.10 máximo)
  // Solo aplica cuando la fuente tiene ≥ 3 decisiones (trust != default 0.5)
  const trustAdjustment = (sourceTrust - 0.5) * 0.20;
  score += trustAdjustment;

  score = Math.max(0, Math.min(1, score));

  // ── Decisión ─────────────────────────────────────────────────────────────

  // Ruido sin ninguna señal de intención → DROP siempre (incluso institucionales)
  // Pero solo si el ruido es muy claro (ej: página de PQRS, términos, etc.)
  if (noiseDetected && !hasIntentSignal && !hasTimeSignal) {
    return { decision: 'DROP', score, reason: 'noise_no_event_signal', isInstitutional, sourceTrust, signals };
  }

  if (isInstitutional) {
    // Institucionales: nunca DROP por score bajo (solo por ruido explícito arriba)
    if (score >= INSTITUTIONAL_ACTIVE_THRESHOLD) {
      return { decision: 'ACTIVE', score, reason: 'institutional_high_confidence', isInstitutional, sourceTrust, signals };
    }
    if (score >= INSTITUTIONAL_REVIEW_THRESHOLD) {
      return { decision: 'PENDING_REVIEW', score, reason: `institutional_low_score (${score.toFixed(2)})`, isInstitutional, sourceTrust, signals };
    }
    // score < 0.10 pero institucional → igual PENDING_REVIEW (no DROP)
    return { decision: 'PENDING_REVIEW', score, reason: `institutional_very_low_score (${score.toFixed(2)})`, isInstitutional, sourceTrust, signals };
  }

  // Fuentes no institucionales
  if (score >= OTHER_ACTIVE_THRESHOLD) {
    return { decision: 'ACTIVE', score, reason: 'ok', isInstitutional, sourceTrust, signals };
  }
  if (score >= OTHER_REVIEW_THRESHOLD) {
    return { decision: 'PENDING_REVIEW', score, reason: `ambiguous_score (${score.toFixed(2)})`, isInstitutional, sourceTrust, signals };
  }
  return { decision: 'DROP', score, reason: `score_too_low (${score.toFixed(2)} < ${OTHER_REVIEW_THRESHOLD})`, isInstitutional, sourceTrust, signals };
}
