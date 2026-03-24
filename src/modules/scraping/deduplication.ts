import crypto from 'crypto';

/**
 * Normaliza un string para comparación
 * Elimina acentos, espacios extras, caracteres especiales
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    // Eliminar acentos
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Eliminar caracteres especiales excepto espacios
    .replace(/[^\w\s]/g, '')
    // Normalizar espacios
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Genera un fingerprint (hash) para una actividad
 * Basado en título normalizado, mes/año, y ubicación
 * Usado para detección rápida de duplicados
 */
export function generateActivityFingerprint(
  title: string,
  dateStr?: string,
  location?: string
): string {
  const normalizedTitle = normalizeString(title);

  // Extraer mes y año de la fecha
  let dateKey = '';
  if (dateStr) {
    const dateMatch = dateStr.match(/(\d{4})-(\d{2})/);
    if (dateMatch) {
      dateKey = `${dateMatch[1]}${dateMatch[2]}`; // YYYYMM
    }
  }

  const normalizedLocation = location ? normalizeString(location) : '';

  // Crear fingerprint: hash de (título + fecha + ubicación)
  const fingerprint = `${normalizedTitle}|${dateKey}|${normalizedLocation}`;

  return crypto
    .createHash('sha256')
    .update(fingerprint)
    .digest('hex')
    .substring(0, 16); // Usar primeros 16 chars
}

/**
 * Calcula similitud entre dos strings (0-100)
 * Usa algoritmo simple: palabras en común / palabras totales
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(normalizeString(str1).split(' '));
  const words2 = new Set(normalizeString(str2).split(' '));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return Math.round((intersection.size / union.size) * 100);
}

/**
 * Detecta si una actividad es potencialmente duplicada
 * Verifica similitud de título y fechas cercanas
 */
export function isProbablyDuplicate(
  title1: string,
  dateStr1: string | undefined,
  title2: string,
  dateStr2: string | undefined,
  minSimilarity: number = 70
): boolean {
  // Similitud de título
  const titleSimilarity = calculateSimilarity(title1, title2);
  if (titleSimilarity < minSimilarity) return false;

  // Si no hay fechas, usar solo similitud de título
  if (!dateStr1 || !dateStr2) return titleSimilarity >= minSimilarity;

  // Extraer año/mes
  const date1 = new Date(dateStr1);
  const date2 = new Date(dateStr2);

  // Consideran duplicado si las fechas están dentro de 7 días
  const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);

  return titleSimilarity >= minSimilarity && daysDiff <= 7;
}

/**
 * Log de duplicados detectados
 */
export function logDuplicate(
  original: { id: string; title: string; source: string },
  potential: { title: string; source: string },
  similarity: number
) {
  console.log(`[DEDUP] Duplicado detectado (${similarity}% similar)`);
  console.log(`  Original: ${original.title} (${original.source})`);
  console.log(`  Potencial: ${potential.title} (${potential.source})`);
}

/**
 * Extrae información temporal de una fecha en múltiples formatos
 */
export function extractDateInfo(dateStr: string): {
  year: number;
  month: number;
  day: number;
  iso: string;
} | null {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;

    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      iso: date.toISOString(),
    };
  } catch {
    return null;
  }
}
