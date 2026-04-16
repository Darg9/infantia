// =============================================================================
// date-preflight.ts — Pre-filtro de fechas antes del NLP (Gemini)
//
// Objetivo: detectar eventos claramente pasados en el HTML/texto scrapeado
// y devolver `true` para que el pipeline salte la llamada a Gemini,
// conservando cuota diaria (20 RPD free tier).
//
// Estrategia en capas (orden de precedencia):
//   1. Atributos datetime="YYYY-MM-DD" del HTML (fuente más confiable)
//   2. Keywords de evento pasado (señal directa, sin parsear fechas)
//   3. Texto plano: formatos ES, ISO, DD/MM/YYYY (fallback)
//
// Diseño conservador:
//   - Sin señales detectadas    → false (incertidumbre → procesar)
//   - Alguna fecha futura       → false (puede ser evento activo)
//   - Todas pasadas < 14d      → false (buffer: evento reciente)
//   - Todas pasadas ≥ 14d      → true  (claramente histórico → saltar NLP)
//   - Keyword de pasado         → true  solo si NO hay fechas futuras detectadas
//
// Impacto esperado vs v1:
//   ↓ 40–50% llamadas a Gemini en fuentes con HTML semántico (BibloRed, Idartes)
//   ↓ 10–15% adicional global via keywords de años pasados
// =============================================================================

const MONTHS_ES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/** Días de margen: solo saltar si el evento pasó hace más de esto. */
const STALE_THRESHOLD_DAYS = 14;

/**
 * Años claramente pasados — señal fuerte sin necesitar fecha completa.
 * Solo años ≤ año_actual - 1 para evitar falsos positivos en referencias.
 */
const PAST_YEAR_SIGNALS = ['2020', '2021', '2022', '2023', '2024', '2025'];

/**
 * Keywords que indican explícitamente que el evento ya ocurrió.
 * Solo se aplican si NO hay fechas futuras detectadas.
 */
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
// API pública
// =============================================================================

/**
 * Devuelve `true` si el HTML/texto claramente describe un evento ya pasado.
 *
 * Orden de evaluación:
 *   1. datetime="" en HTML (más confiable)
 *   2. Texto plano con formatos de fecha reconocidos
 *   3. Keywords de evento pasado (solo si no hay fechas futuras)
 *
 * Conservador por diseño — prefiere falsos negativos (procesar de más)
 * sobre falsos positivos (perder un evento futuro).
 */
export function isPastEventContent(html: string, referenceDate = new Date()): boolean {
  // ── Capa 1: atributos datetime="" ─────────────────────────────────────────
  const datetimeDates = extractDatetimeAttributes(html);
  if (datetimeDates.length > 0) {
    const hasAnyFuture = datetimeDates.some((d) => d >= referenceDate);
    if (hasAnyFuture) return false;
    const staleCutoff = new Date(referenceDate.getTime() - STALE_THRESHOLD_DAYS * 86_400_000);
    if (datetimeDates.every((d) => d < staleCutoff)) return true;
    // Dentro del buffer de 14d → no descartar (puede seguir activo)
    return false;
  }

  // ── Capa 2: fechas en texto plano ─────────────────────────────────────────
  const textDates = extractDatesFromText(html);
  if (textDates.length > 0) {
    const hasAnyFuture = textDates.some((d) => d >= referenceDate);
    if (hasAnyFuture) return false;
    const staleCutoff = new Date(referenceDate.getTime() - STALE_THRESHOLD_DAYS * 86_400_000);
    if (textDates.every((d) => d < staleCutoff)) return true;
    return false;
  }

  // ── Capa 3: keywords de evento pasado (sin fechas detectadas) ─────────────
  const lower = html.toLowerCase();
  const hasFutureYear = !PAST_YEAR_SIGNALS.every((yr) => lower.includes(yr))
    && !lower.includes(String(referenceDate.getFullYear()));

  // Años pasados explícitos (sin año futuro presente)
  const onlyPastYears =
    PAST_YEAR_SIGNALS.some((yr) => lower.includes(yr)) &&
    !lower.includes(String(referenceDate.getFullYear())) &&
    !lower.includes(String(referenceDate.getFullYear() + 1));

  if (onlyPastYears) return true;

  // Keywords directos de evento finalizado
  if (PAST_EVENT_KEYWORDS.some((kw) => lower.includes(kw))) {
    // Solo descartar si no hay ningún indicio de año futuro
    const currentYear = referenceDate.getFullYear();
    const noFutureSignal =
      !lower.includes(String(currentYear)) &&
      !lower.includes(String(currentYear + 1));
    if (noFutureSignal) return true;
  }

  return false;
  void hasFutureYear; // usado implícitamente arriba — silencia TS
}

// =============================================================================
// Extracción de fechas
// =============================================================================

/**
 * Extrae fechas de atributos `datetime="YYYY-MM-DD"` en el HTML.
 * Fuente más confiable — generada por el CMS, no por el contenido editorial.
 * Exportada para tests.
 */
export function extractDatetimeAttributes(html: string): Date[] {
  const dates: Date[] = [];
  // Captura: datetime="2025-04-20" o datetime="2025-04-20T15:00:00"
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

  // Patrón ES: "15 de abril de 2025" / "15 de abril 2025"
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
