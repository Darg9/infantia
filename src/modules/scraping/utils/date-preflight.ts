// =============================================================================
// date-preflight.ts — Pre-filtro de fechas antes del NLP (Gemini)
//
// Objetivo: detectar eventos claramente pasados en el texto scrapeado
// y devolver `true` para que el pipeline salte la llamada a Gemini,
// conservando cuota diaria (20 RPD free tier).
//
// Diseño conservador:
//   - Sin fechas detectadas  → false (incertidumbre → procesar)
//   - Alguna fecha futura    → false (puede ser evento activo)
//   - Todas pasadas < 14d   → false (buffer: evento reciente, puede seguir activo)
//   - Todas pasadas ≥ 14d   → true  (claramente histórico → saltar NLP)
// =============================================================================

const MONTHS_ES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/** Días de margen: solo saltar si el evento pasó hace más de esto. */
const STALE_THRESHOLD_DAYS = 14;

/**
 * Devuelve `true` si el texto claramente describe un evento ya pasado.
 * Conservador por diseño — prefiere falsos negativos (procesar de más)
 * sobre falsos positivos (perder un evento futuro).
 */
export function isPastEventContent(text: string, referenceDate = new Date()): boolean {
  const dates = extractDatesFromText(text);
  if (dates.length === 0) return false;

  const hasAnyFuture = dates.some((d) => d >= referenceDate);
  if (hasAnyFuture) return false;

  const staleCutoff = new Date(referenceDate.getTime() - STALE_THRESHOLD_DAYS * 86_400_000);
  return dates.every((d) => d < staleCutoff);
}

/**
 * Extrae todas las fechas reconocibles del texto (formatos ES e ISO).
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

function isValidYear(year: number): boolean {
  return year >= 2020 && year <= 2035;
}

function addDate(dates: Date[], year: number, monthIndex: number, day: number): void {
  if (day < 1 || day > 31) return;
  const d = new Date(year, monthIndex, day);
  if (!isNaN(d.getTime())) dates.push(d);
}
