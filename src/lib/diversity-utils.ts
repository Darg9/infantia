// =============================================================================
// diversity-utils.ts — Diversificación de resultados por categoría
//
// Estrategia simple: round-robin entre categorías sobre candidatos
// ya ordenados por relevancia/fecha.
//
// Propiedades:
//   - Determinista: mismo input → mismo output (sin random).
//   - Respeta score: dentro de cada categoría, el orden de relevancia se preserva.
//   - Degradación suave: si hay pocas categorías, repite la que toca.
//
// Uso:
//   const diverse = roundRobinByCategory(sortedCandidates, 4);
//
// Evolución futura (cuando haya 8+ slots y mejor cobertura de fechas):
//   - Añadir agrupación por bucket temporal (Hoy / Mañana / Finde) antes del round-robin.
//   - Por ahora no aplica: 60% sin fecha y solo 4 slots hacen los buckets ineficaces.
// =============================================================================

type WithCategories = {
  categories: { category: { slug: string; name: string } }[];
};

/**
 * Toma `take` elementos de `candidates` diversificando por categoría.
 *
 * Algoritmo:
 *   1. Agrupar por slug de la categoría principal.
 *   2. Iterar en round-robin: una actividad de cada categoría por vuelta.
 *   3. Dentro de cada grupo, preservar el orden original (mejor score primero).
 *   4. Repetir categorías solo cuando el pool se agote antes de llegar a `take`.
 */
export function roundRobinByCategory<T extends WithCategories>(
  candidates: T[],
  take: number,
): T[] {
  if (candidates.length === 0 || take <= 0) return [];
  if (take >= candidates.length) return candidates;

  // Agrupar preservando el orden de entrada (mayor relevancia/más reciente primero)
  const groups = new Map<string, T[]>();
  for (const item of candidates) {
    const slug = item.categories[0]?.category.slug ?? '__sin_categoria__';
    if (!groups.has(slug)) groups.set(slug, []);
    groups.get(slug)!.push(item);
  }

  const result: T[] = [];
  const keys = [...groups.keys()];

  // Round-robin: una pasada toma un item de cada categoría disponible
  outer: while (result.length < take) {
    let anyLeft = false;
    for (const key of keys) {
      if (result.length >= take) break outer;
      const group = groups.get(key)!;
      if (group.length > 0) {
        result.push(group.shift()!);
        anyLeft = true;
      }
    }
    if (!anyLeft) break; // Todos los grupos vacíos
  }

  return result;
}
