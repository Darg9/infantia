// =============================================================================
// date-preflight.ts — Pre-filtro de fechas antes del NLP (Gemini)
//
// Objetivo: detectar eventos claramente pasados en el HTML/texto scrapeado
// y devolver `true` para que el pipeline salte la llamada a Gemini,
// conservando cuota diaria (20 RPD free tier).
//
// Estrategia en capas (orden de precedencia):
//   1. Atributos datetime="YYYY-MM-DD" del HTML (fuente más confiable)
//   2. Texto plano: formatos ES, ISO, DD/MM/YYYY (fallback)
//   3. Keywords de evento pasado + años pasados sin año actual (heurística)
//
// Diseño conservador:
//   - Sin señales detectadas    → false (incertidumbre → procesar)
//   - Alguna fecha futura       → false (puede ser evento activo)
//   - Todas pasadas < 14d      → false (buffer: evento reciente)
//   - Todas pasadas ≥ 14d      → true  (claramente histórico → saltar NLP)
//
// Instrumentación (S48b):
//   - evaluatePreflight() devuelve { skip, reason, datesFound }
//   - preflightStats acumula contadores por sesión
//   - resetPreflightStats() para tests
// =============================================================================

const MONTHS_ES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/** Días de margen: solo saltar si el evento pasó hace más de esto. */
const STALE_THRESHOLD_DAYS = 14;

const PAST_YEAR_SIGNALS = ['2020', '2021', '2022', '2023', '2024', '2025'];

const PAST_EVENT_KEYWORDS = [
  'evento finalizado',
  'finalizado',
  'ya ocurrió',
  'ya se realizó',
  'cerrado',
  'inscripciones cerradas',
  'cupos agotados',
];

// =============================================================================
// Tipos públicos
// =============================================================================

export type PreflightReason =
  | 'datetime_past'   // Capa 1: atributo datetime en HTML
  | 'text_date_past'  // Capa 2: fecha en texto plano
  | 'past_year_only'  // Capa 3a: solo años pasados sin año actual
  | 'keyword_past'    // Capa 3b: keyword de evento finalizado
  | 'process'         // No se descarta → va a Gemini
  ;

export interface PreflightResult {
  skip:       boolean;
  reason:     PreflightReason;
  datesFound: number;   // cuántas fechas se detectaron (0 = sin señal)
}

// =============================================================================
// Contadores de sesión (instrumentación)
// =============================================================================

export interface PreflightStats {
  skipped_datetime:   number;
  skipped_text_date:  number;
  skipped_past_year:  number;
  skipped_keyword:    number;
  sent_to_gemini:     number;
  total:              number;
}

let _stats: PreflightStats = {
  skipped_datetime:  0,
  skipped_text_date: 0,
  skipped_past_year: 0,
  skipped_keyword:   0,
  sent_to_gemini:    0,
  total:             0,
};

/** Retorna los contadores acumulados de la sesión actual. */
export function getPreflightStats(): Readonly<PreflightStats> {
  return { ..._stats };
}

/** Resetea contadores — usar en tests o al inicio de cada run. */
export function resetPreflightStats(): void {
  _stats = {
    skipped_datetime:  0,
    skipped_text_date: 0,
    skipped_past_year: 0,
    skipped_keyword:   0,
    sent_to_gemini:    0,
    total:             0,
  };
}

// =============================================================================
// API pública
// =============================================================================

/**
 * Versión enriquecida: devuelve resultado + razón + fechas encontradas.
 * Úsala en pipeline.ts para logging estructurado.
 */
export function evaluatePreflight(html: string, referenceDate = new Date()): PreflightResult {
  _stats.total++;

  const result = _evaluate(html, referenceDate);

  // Actualizar contador de la razón
  if (result.skip) {
    if (result.reason === 'datetime_past')  _stats.skipped_datetime++;
    if (result.reason === 'text_date_past') _stats.skipped_text_date++;
    if (result.reason === 'past_year_only') _stats.skipped_past_year++;
    if (result.reason === 'keyword_past')   _stats.skipped_keyword++;
  } else {
    _stats.sent_to_gemini++;
  }

  return result;
}

/**
 * API simplificada (backward-compatible).
 * Devuelve solo el booleano — usa evaluatePreflight() para logging.
 */
export function isPastEventContent(html: string, referenceDate = new Date()): boolean {
  return evaluatePreflight(html, referenceDate).skip;
}

// =============================================================================
// Lógica interna
// =============================================================================

function _evaluate(html: string, referenceDate: Date): PreflightResult {
  const staleCutoff = new Date(referenceDate.getTime() - STALE_THRESHOLD_DAYS * 86_400_000);

  // ── Capa 1: atributos datetime="" ─────────────────────────────────────────
  const datetimeDates = extractDatetimeAttributes(html);
  if (datetimeDates.length > 0) {
    if (datetimeDates.some((d) => d >= referenceDate)) {
      return { skip: false, reason: 'process', datesFound: datetimeDates.length };
    }
    if (datetimeDates.every((d) => d < staleCutoff)) {
      return { skip: true, reason: 'datetime_past', datesFound: datetimeDates.length };
    }
    // Dentro del buffer de 14d → conservador
    return { skip: false, reason: 'process', datesFound: datetimeDates.length };
  }

  // ── Capa 2: fechas en texto plano ─────────────────────────────────────────
  const textDates = extractDatesFromText(html);
  if (textDates.length > 0) {
    if (textDates.some((d) => d >= referenceDate)) {
      return { skip: false, reason: 'process', datesFound: textDates.length };
    }
    if (textDates.every((d) => d < staleCutoff)) {
      return { skip: true, reason: 'text_date_past', datesFound: textDates.length };
    }
    return { skip: false, reason: 'process', datesFound: textDates.length };
  }

  // ── Capa 3: keywords y años pasados (sin fechas detectadas) ───────────────
  const lower = html.toLowerCase();
  const currentYear = referenceDate.getFullYear();

  const onlyPastYears =
    PAST_YEAR_SIGNALS.some((yr) => lower.includes(yr)) &&
    !lower.includes(String(currentYear)) &&
    !lower.includes(String(currentYear + 1));

  if (onlyPastYears) {
    return { skip: true, reason: 'past_year_only', datesFound: 0 };
  }

  const hasKeyword = PAST_EVENT_KEYWORDS.some((kw) => lower.includes(kw));
  if (hasKeyword) {
    const noFutureSignal =
      !lower.includes(String(currentYear)) &&
      !lower.includes(String(currentYear + 1));
    if (noFutureSignal) {
      return { skip: true, reason: 'keyword_past', datesFound: 0 };
    }
  }

  return { skip: false, reason: 'process', datesFound: 0 };
}

// =============================================================================
// Extracción de fechas
// =============================================================================

/**
 * Extrae fechas de atributos `datetime="YYYY-MM-DD"` en el HTML.
 * Exportada para tests.
 */
export function extractDatetimeAttributes(html: string): Date[] {
  const dates: Date[] = [];
  const pattern = /datetime="(\d{4}-\d{2}-\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const [yr, mo, dy] = m[1].split('-').map(Number);
    if (isValidYear(yr) && mo >= 1 && mo <= 12) addDate(dates, yr, mo - 1, dy);
  }
  return dates;
}

/**
 * Extrae todas las fechas reconocibles del texto plano (formatos ES e ISO).
 * Exportada para tests y depuración.
 */
export function extractDatesFromText(text: string): Date[] {
  const dates: Date[] = [];
  const lower = text.toLowerCase();

  // Patrón ES: "15 de abril de 2025"
  const p1 =
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})/g;
  let m: RegExpExecArray | null;
  while ((m = p1.exec(lower)) !== null) {
    const day = parseInt(m[1]);
    const month = MONTHS_ES[m[2]];
    const year = parseInt(m[3]);
    if (month && isValidYear(year)) addDate(dates, year, month - 1, day);
  }

  // Patrón ISO: 2025-04-15
  const p2 = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = p2.exec(text)) !== null) {
    const yr = parseInt(m[1]), mo = parseInt(m[2]), dy = parseInt(m[3]);
    if (isValidYear(yr) && mo >= 1 && mo <= 12) addDate(dates, yr, mo - 1, dy);
  }

  // Patrón DD/MM/YYYY
  const p3 = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  while ((m = p3.exec(text)) !== null) {
    const dy = parseInt(m[1]), mo = parseInt(m[2]), yr = parseInt(m[3]);
    if (isValidYear(yr) && mo >= 1 && mo <= 12) addDate(dates, yr, mo - 1, dy);
  }

  return dates;
}

// =============================================================================
// Helpers internos
// =============================================================================

function isValidYear(year: number): boolean {
  return year >= 2020 && year <= 2035;
}

function addDate(dates: Date[], year: number, monthIndex: number, day: number): void {
  if (day < 1 || day > 31) return;
  const d = new Date(year, monthIndex, day);
  if (!isNaN(d.getTime())) dates.push(d);
}
