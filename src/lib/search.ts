// =============================================================================
// Search Normalizer
// Limpia y estandariza queries de búsqueda excluyendo stopwords inútiles
// conservando semántica y números.
// =============================================================================

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'y', 'o', 'e', 'ni',
  'en', 'de', 'del', 'para', 'con', 'a', 'al', 'por', 'sin', 'sobre',
  'es', 'son', 'que'
]);

export function normalizeSearchQuery(q: string): string {
  if (!q) return '';
  
  // 1. Lowercase y eliminación de caracteres sueltos conflictivos
  const raw = q.toLowerCase().replace(/[.,!?;:()]/g, ' ').trim();
  
  // 2. Tokenizar colapsando espacios múltiples
  const tokens = raw.split(/\s+/);
  
  // 3. Filtrar
  const filtered = tokens.filter(t => {
    if (STOPWORDS.has(t)) return false;
    return true; // Conservar resto (incluye números y palabras de 2+ chars como '3', 'en', perdon, 'ar', 'ai', 'arte')
  });

  // Si después de limpiar nos quedamos sin nada (el usuario solo buscó stopwords), 
  // revertimos al raw fallback para no romper queries exactos extraños.
  return filtered.length > 0 ? filtered.join(' ') : raw;
}
