// =============================================================================
// city-normalizer.ts — Normalización canónica de nombres de ciudad
//
// Problema: "Bogotá", "Bogota", "Bogotá D.C.", "BOGOTÁ", "bogota dc"
//           → deben mapear a la misma ciudad en BD
//
// Pipeline de normalización (determinístico, sin red):
//   1. NFD + strip diacritics  → "Bogotá" → "Bogota"
//   2. Lowercase               → "Bogota" → "bogota"
//   3. Strip sufijos comunes   → "bogota d.c." → "bogota"
//   4. Collapse whitespace     → "bogota  " → "bogota"
//
// Levenshtein inline — sin dependencias externas.
// =============================================================================

// Sufijos que no aportan identidad a la ciudad
const CITY_SUFFIXES = [
  /\bd\.c\.?\b/gi,          // D.C., D.C
  /\bdistrital\b/gi,        // "Bogotá Distrital"
  /\bcapital\b/gi,          // "Bogotá Capital"
  /\bcolom(bia)?\b/gi,      // "Bogotá Colombia"
  /\bdepartamento\b/gi,     // "Cundinamarca Departamento"
  /,.*$/,                   // "Bogotá, Colombia" → "Bogotá"
];

/**
 * Normaliza el nombre de una ciudad a una forma canónica comparable.
 * "Bogotá D.C." → "bogota"
 * "Medellín, Antioquia" → "medellin"
 */
export function normalizeCity(name: string): string {
  if (!name || !name.trim()) return '';

  let result = name
    // 1. NFD → quita diacriticos (tildes, ñ → n)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // 2. Lowercase
    .toLowerCase();

  // 3. Strip sufijos comunes
  for (const pattern of CITY_SUFFIXES) {
    result = result.replace(pattern, '');
  }

  // 4. Collapse whitespace + strip puntuación sobrante al final ("bogota ." → "bogota")
  return result.replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim();
}

// ── Levenshtein (sin dependencias) ───────────────────────────────────────────

/**
 * Distancia de edición entre dos strings.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // dp[i][j] = distancia entre a[0..i-1] y b[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Score de similitud entre 0 y 1 (1 = idéntico).
 * Basado en Levenshtein normalizado por la longitud máxima.
 */
export function citySimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}
