// =============================================================================
// Activity Gate — Filtro de validez de contenido pre-persistencia
//
// Responsabilidad: decidir si un resultado del NLP es una actividad real
// antes de llamar a saveActivity(). Complementa el Date Preflight (fechas)
// con señales de intención, tiempo y ruido institucional.
//
// Integración:
//   const gate = evaluateActivityGate(data, url);
//   if (!gate.pass) { log.info('[GATE] Descartado', gate); continue; }
//
// Filosofía:
//   - Mejor perder 10 actividades reales que guardar 100 falsas
//   - No depende de IA adicional (heurísticas determinísticas)
//   - No modifica datos — solo devuelve pass/fail + motivo
// =============================================================================

export interface GateResult {
  pass: boolean;
  score: number;      // 0.0 – 1.0
  reason: string;     // motivo de rechazo o 'ok'
  signals: {
    hasIntentSignal: boolean;
    hasTimeSignal: boolean;
    hasLocationSignal: boolean;
    noiseDetected: boolean;
    blockedBySourcePath: boolean;
  };
}

// ─── Señales de intención (≥1 → indicio de actividad real) ──────────────────
const INTENT_KEYWORDS = [
  'taller', 'workshop', 'evento', 'inscripción', 'inscripcion',
  'función', 'funcion', 'clases', 'clase', 'agenda', 'programación',
  'programacion', 'concierto', 'exposición', 'exposicion', 'festival',
  'feria', 'campamento', 'visita', 'tour', 'laboratorio', 'charla',
  'conferencia', 'encuentro', 'performance', 'obra', 'show',
  'actividad', 'curso', 'ciclo', 'temporada', 'lanzamiento',
];

// ─── Señales de tiempo en texto (obligatorio para actividades) ───────────────
const TIME_KEYWORDS = [
  // Fechas explícitas
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  // Formato numérico
  /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,
  /\d{4}-\d{2}-\d{2}/,
  // Palabras clave temporales
  'hoy', 'mañana', 'manana', 'próximo', 'proximo', 'próxima', 'proxima',
  // Horarios
  /\d{1,2}:\d{2}/,
  'am', 'pm', 'hours', 'hora', 'horas',
  // Frecuencia
  'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo',
  'semanal', 'diario', 'mensual',
];

// ─── Señales de ruido institucional (presencia → penalización alta) ──────────
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

// ─── Paths de fuentes problemáticas que solo se aceptan por ruta específica ──
// formato: { domain, allowedPaths[] }
const SOURCE_PATH_ALLOWLIST: { domain: string; allowed: string[] }[] = [
  {
    domain: 'bogota.gov.co',
    allowed: ['/que-hacer/agenda-cultural', '/programate', '/cultura', '/parques'],
  },
  {
    domain: 'fce.com.co',
    allowed: ['/eventos', '/conferencias', '/presentaciones', '/lanzamiento'],
  },
];

// ─── Helper: check texto contra keywords mixtos (string | RegExp) ────────────
function matchesAny(text: string, patterns: (string | RegExp)[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some(p =>
    typeof p === 'string' ? lower.includes(p.toLowerCase()) : p.test(text)
  );
}

// ─── Verificar restricción por path de fuente ────────────────────────────────
function isBlockedBySourcePath(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace('www.', '');
    const path = parsed.pathname;
    const rule = SOURCE_PATH_ALLOWLIST.find(r => hostname.includes(r.domain));
    if (!rule) return false; // dominio no restringido → no bloqueado
    // El dominio está en la lista restringida: solo pasa si coincide con un path permitido
    return !rule.allowed.some(allowed => path.startsWith(allowed));
  } catch {
    return false;
  }
}

// ─── Evaluación principal ────────────────────────────────────────────────────

/**
 * Evalúa si un resultado NLP representa una actividad real.
 * Devuelve pass=true solo si supera el umbral (score >= GATE_THRESHOLD).
 */
export function evaluateActivityGate(
  data: ActivityNLPResult,
  sourceUrl: string,
): GateResult {
  const GATE_THRESHOLD = 0.4;

  const fullText = `${data.title} ${data.description ?? ''}`.toLowerCase();

  // ── Señal 1: Intención ───────────────────────────────────────────────────
  const hasIntentSignal = matchesAny(fullText, INTENT_KEYWORDS);

  // ── Señal 2: Tiempo (schedules populados OR texto menciona fechas) ────────
  const hasSchedules = !!(data.schedules && data.schedules.length > 0);
  const hasTimeSignal = hasSchedules || matchesAny(fullText, TIME_KEYWORDS);

  // ── Señal 3: Location en descripción (texto menciona lugar) ──────────────
  const hasLocationSignal = matchesAny(fullText, [
    'bogotá', 'bogota', 'medellín', 'medellin', 'cali', 'cartagena',
    'presencial', 'virtual', 'online', 'en vivo', 'auditorio', 'sede',
    'sala', 'teatro', 'parque', 'biblioteca', 'museo', 'centro',
  ]);

  // ── Señal 4: Ruido institucional ─────────────────────────────────────────
  const noiseDetected = matchesAny(fullText, NOISE_KEYWORDS);

  // ── Señal 5: Path restringido por dominio ────────────────────────────────
  const blockedBySourcePath = isBlockedBySourcePath(sourceUrl);

  // ── Score (0.0 – 1.0) ────────────────────────────────────────────────────
  let score = 0;
  if (hasIntentSignal)    score += 0.25;
  if (hasTimeSignal)      score += 0.30;
  if (hasLocationSignal)  score += 0.15;
  score += data.confidenceScore * 0.30; // Gemini score como señal complementaria
  if (noiseDetected)      score -= 0.40;
  if (blockedBySourcePath) score -= 0.60;

  score = Math.max(0, Math.min(1, score));

  // ── Decisión ─────────────────────────────────────────────────────────────
  const signals = {
    hasIntentSignal,
    hasTimeSignal,
    hasLocationSignal,
    noiseDetected,
    blockedBySourcePath,
  };

  // Hard blocks — falla inmediata independiente del score
  if (blockedBySourcePath) {
    return { pass: false, score, reason: 'blocked_by_source_path', signals };
  }
  if (noiseDetected && !hasIntentSignal) {
    return { pass: false, score, reason: 'institutional_noise_no_intent', signals };
  }
  if (!hasTimeSignal && !hasIntentSignal) {
    return { pass: false, score, reason: 'no_time_no_intent_signal', signals };
  }

  // Soft threshold
  if (score < GATE_THRESHOLD) {
    return { pass: false, score, reason: `score_below_threshold (${score.toFixed(2)} < ${GATE_THRESHOLD})`, signals };
  }

  return { pass: true, score, reason: 'ok', signals };
}
