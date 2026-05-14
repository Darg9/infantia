// =============================================================================
// category-utils — Utilidades compartidas para visualización de categorías
// =============================================================================

export const CATEGORY_COLORS = [
  'bg-brand-100', 'bg-success-100', 'bg-warning-100', 'bg-error-100',
  'bg-info-100', 'bg-brand-200', 'bg-brand-50', 'bg-success-200',
] as const;

// Gradientes por slug de categoría (para placeholder visual cuando no hay og:image)
//
// Paleta S72 — separación perceptual máxima entre categorías cercanas:
//   Música   → violeta/índigo  (frío, profundo)
//   Teatro   → magenta/fucsia  (cálido, dramático) ← antes también violeta: bug visual
//   Ciencia  → azul/cian
//   Arte     → coral/naranja
//   Lectura  → ámbar/marrón
//   Deportes → verde esmeralda
//   Naturaleza → verde-teal (distinguible de Deportes por el teal)
//   Manualidades → lima/amarillo
//
// Slugs: se mapean tanto los canónicos S68 (teatro-y-danza, ciencia-y-tec)
// como los legacy (teatro, ciencias) para compatibilidad con datos existentes.
// Rueda de hues (S73) — distancias mínimas entre canónicas para scroll rápido:
//   Arte        25°  coral→ámbar
//   Manualidades 50°  amarillo→ámbar  (Δ25° de Arte)
//   Deportes     90°  lima→verde      (Δ40° de Manualidades)
//   Naturaleza  175°  teal claro→teal (Δ85° de Deportes)
//   Ciencia     190°  cian→azul       (Δ15° — distintos por brillo: cian brillante vs teal oscuro)
//   Lectura     220°  azul→azul prof  (Δ30° de Ciencia, distintos por saturación/profundidad)
//   Música      280°  violeta→púrpura (Δ60° de Lectura)
//   Teatro      330°  fucsia→magenta  (Δ50° de Música)
const CATEGORY_GRADIENTS: Record<string, string> = {
  // ── Canónicos S68 ────────────────────────────────────────────────────────
  'arte-y-creatividad':  'linear-gradient(135deg, #f97316 0%, #fbbf24 100%)', // coral→ámbar (25°)     KEEP
  'lectura':             'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)', // azul→azul prof (220°) FIX: slate invisible dark mode
  'musica':              'linear-gradient(135deg, #a855f7 0%, #6d28d9 100%)', // violeta→púrpura (280°) +saturación
  'música':              'linear-gradient(135deg, #a855f7 0%, #6d28d9 100%)', // alias con tilde
  'teatro-y-danza':      'linear-gradient(135deg, #ec4899 0%, #9d174d 100%)', // fucsia→magenta (330°)  KEEP
  'ciencia-y-tec':       'linear-gradient(135deg, #22d3ee 0%, #0284c7 100%)', // cian→azul (190°)      más brillante
  'naturaleza':          'linear-gradient(135deg, #2dd4bf 0%, #0f766e 100%)', // teal claro→teal (175°) más orgánico
  'deportes':            'linear-gradient(135deg, #a3e635 0%, #3f6212 100%)', // lima→oliva (90°)      energía
  'manualidades':        'linear-gradient(135deg, #facc15 0%, #b45309 100%)', // amarillo→ámbar (50°)  FIX: evita conflicto Arte+Teatro
  // ── Legacy / aliases ─────────────────────────────────────────────────────
  'teatro':              'linear-gradient(135deg, #ec4899 0%, #9d174d 100%)',
  'ciencias':            'linear-gradient(135deg, #22d3ee 0%, #0284c7 100%)',
  'tecnologia':          'linear-gradient(135deg, #22d3ee 0%, #0284c7 100%)',
  'danza':               'linear-gradient(135deg, #f472b6 0%, #a21caf 100%)', // rosa→púrpura
  'artes-marciales':     'linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)',
  'cocina':              'linear-gradient(135deg, #fb923c 0%, #fde68a 100%)',
  'pintura-y-dibujo':    'linear-gradient(135deg, #f97316 0%, #db2777 100%)',
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

// ── Etiquetas cortas para el chip de categoría en la tarjeta compacta ────────
// Mapeadas desde los slugs canónicos (post-S68: 7 categorías + Arte staging).
const CATEGORY_SHORT_LABELS: Record<string, string> = {
  'lectura':            'Lectura',
  'musica':             'Música',
  'música':             'Música',
  'teatro-y-danza':     'Teatro',
  'teatro':             'Teatro',
  'ciencia-y-tec':      'Ciencia',
  'ciencias':           'Ciencia',
  'tecnologia':         'Ciencia',
  'naturaleza':         'Naturaleza',
  'deportes':           'Deportes',
  'manualidades':       'Manualidades',
  'arte-y-creatividad': 'Arte',
  'arte':               'Arte',
  'pintura-y-dibujo':   'Arte',
  'danza':              'Danza',
  'cocina':             'Cocina',
  'yoga-infantil':      'Yoga',
};

/**
 * Devuelve una etiqueta corta (≤12 chars) para mostrar en el chip de categoría
 * en la tarjeta compacta del home.
 */
export function getCategoryShortLabel(slug: string, fallbackName: string): string {
  const normalized = slug.toLowerCase();
  if (CATEGORY_SHORT_LABELS[normalized]) return CATEGORY_SHORT_LABELS[normalized];
  // Fallback: primera palabra del nombre, máx 12 chars
  const first = fallbackName.split(' ')[0];
  return first.length > 12 ? first.slice(0, 11) + '…' : first;
}
