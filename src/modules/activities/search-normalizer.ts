export const STOP_WORDS = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'un', 'una', 'unos', 'unas', 'para', 'por', 'con'
]);

/**
 * Normaliza una búsqueda eliminando tildes, pasando a minúsculas,
 * eliminando stop-words y dejando un máximo de 3 tokens fuertes.
 */
export function normalizeQuery(q: string): string {
  if (!q || typeof q !== 'string') return '';
  
  return q
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina diacríticos (tildes)
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 3 && !STOP_WORDS.has(t))
    .slice(0, 3)
    .join(' ');
}
