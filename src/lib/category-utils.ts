// =============================================================================
// category-utils — Utilidades compartidas para visualización de categorías
// =============================================================================

export const CATEGORY_COLORS = [
  'bg-indigo-100', 'bg-emerald-100', 'bg-amber-100', 'bg-rose-100',
  'bg-cyan-100', 'bg-violet-100', 'bg-orange-100', 'bg-teal-100',
] as const;

const CATEGORY_EMOJIS: Record<string, string> = {
  'arte': '🎨', 'pintura': '🖌️', 'dibujo': '✏️',
  'música': '🎵', 'piano': '🎹', 'guitarra': '🎸', 'canto': '🎤',
  'deporte': '⚽', 'fútbol': '⚽', 'natación': '🏊', 'tenis': '🎾',
  'teatro': '🎭', 'actuación': '🎭',
  'danza': '💃', 'ballet': '🩰', 'baile': '💃',
  'ciencia': '🔬', 'experimento': '🔬',
  'lectura': '📚', 'libro': '📚',
  'tecnología': '💻', 'programación': '💻', 'robótica': '🤖',
  'cocina': '👨‍🍳', 'repostería': '🍰',
  'naturaleza': '🌿', 'ecología': '🌱',
  'yoga': '🧘', 'bienestar': '💆',
  'manualidad': '✂️',
  'cine': '🎬', 'audiovisual': '🎬',
  'lúdico': '🎮', 'juego': '🎲',
  'campamento': '⛺',
  'idioma': '🌍', 'inglés': '🌍', 'francés': '🌍',
  'matemática': '🔢', 'ajedrez': '♟️',
};

/** Devuelve un emoji representativo para una categoría dado su nombre. */
export function getCategoryEmoji(categoryName: string): string {
  const lower = categoryName.toLowerCase();
  for (const [key, emoji] of Object.entries(CATEGORY_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return '✨';
}

/** Devuelve una clase Tailwind de color de fondo basada en el slug de la categoría. */
export function getCategoryColor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}
