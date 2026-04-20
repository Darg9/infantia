// =============================================================================
// category-utils — Utilidades compartidas para visualización de categorías
// =============================================================================

export const CATEGORY_COLORS = [
  'bg-indigo-100', 'bg-emerald-100', 'bg-amber-100', 'bg-rose-100',
  'bg-cyan-100', 'bg-violet-100', 'bg-orange-100', 'bg-teal-100',
] as const;

// Gradientes por slug de categoría (para placeholder visual cuando no hay og:image)
const CATEGORY_GRADIENTS: Record<string, string> = {
  'arte-y-creatividad':  'linear-gradient(135deg, #f97316 0%, #fbbf24 100%)',
  'artes-marciales':     'linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)',
  'ciencias':            'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
  'cocina':              'linear-gradient(135deg, #fb923c 0%, #fde68a 100%)',
  'danza':               'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
  'deportes':            'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
  'lectura':             'linear-gradient(135deg, #d97706 0%, #92400e 100%)',
  'manualidades':        'linear-gradient(135deg, #84cc16 0%, #eab308 100%)',
  'musica':              'linear-gradient(135deg, #8b5cf6 0%, #4338ca 100%)',
  'naturaleza':          'linear-gradient(135deg, #34d399 0%, #047857 100%)',
  'pintura-y-dibujo':    'linear-gradient(135deg, #f97316 0%, #db2777 100%)',
  'teatro':              'linear-gradient(135deg, #a855f7 0%, #be123c 100%)',
  'tecnologia':          'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
  'yoga-infantil':       'linear-gradient(135deg, #14b8a6 0%, #22c55e 100%)',
};

// Gradientes de fallback (cuando el slug no coincide exactamente)
const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
  'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
  'linear-gradient(135deg, #f97316 0%, #fbbf24 100%)',
  'linear-gradient(135deg, #14b8a6 0%, #22c55e 100%)',
];

/** Devuelve un gradiente CSS para usar como background de placeholder sin imagen. */
export function getCategoryGradient(slug: string): string {
  if (CATEGORY_GRADIENTS[slug]) return CATEGORY_GRADIENTS[slug];
  // Fallback: hash del slug → gradiente consistente
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_GRADIENTS[Math.abs(hash) % FALLBACK_GRADIENTS.length];
}

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
