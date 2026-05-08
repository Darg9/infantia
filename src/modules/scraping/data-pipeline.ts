import { ActivityNLPResult } from './types';

// =============================================================================
// CATEGORY STANDARDIZATION MAP
// Mapea ruido natural inferido por LLM hacia buckets definidos
// =============================================================================
const CATEGORY_MAP: Record<string, string> = {
  // ── Arte y Creatividad ──────────────────────────────────────────────────────
  'arte': 'Arte y Creatividad', 'artes': 'Arte y Creatividad',
  'arte y creatividad': 'Arte y Creatividad',
  'artes audiovisuales': 'Arte y Creatividad', 'audiovisual': 'Arte y Creatividad', 'cine': 'Arte y Creatividad',
  'fotografía': 'Arte y Creatividad', 'fotografia': 'Arte y Creatividad',
  'comics': 'Arte y Creatividad', 'ilustracion': 'Arte y Creatividad', 'ilustración': 'Arte y Creatividad',
  'escultura': 'Arte y Creatividad', 'modelado': 'Arte y Creatividad',
  'talleres': 'Arte y Creatividad', 'taller': 'Arte y Creatividad', 'workshop': 'Arte y Creatividad',
  // Lúdico — "Artes Lúdicas" en Idartes/SCRD: circo, magia, títeres, juegos creativos
  'lúdico': 'Arte y Creatividad', 'ludico': 'Arte y Creatividad',
  'artes lúdicas': 'Arte y Creatividad', 'artes ludicas': 'Arte y Creatividad',
  'juegos': 'Arte y Creatividad', 'gamification': 'Arte y Creatividad', 'juegos de mesa': 'Arte y Creatividad',
  'circo': 'Arte y Creatividad', 'magia': 'Arte y Creatividad', 'títeres': 'Arte y Creatividad', 'titeres': 'Arte y Creatividad',

  // ── Manualidades y Pintura y Dibujo ────────────────────────────────────────
  'manualidades': 'Manualidades',
  'pintura': 'Pintura y Dibujo', 'dibujo': 'Pintura y Dibujo', 'pintura y dibujo': 'Pintura y Dibujo',

  // ── Cerámica ────────────────────────────────────────────────────────────────
  'cerámica': 'Cerámica', 'ceramica': 'Cerámica', 'barro': 'Cerámica',

  // ── Cocina ──────────────────────────────────────────────────────────────────
  'cocina': 'Cocina', 'gastronomia': 'Cocina', 'gastronomía': 'Cocina', 'reposteria': 'Cocina', 'repostería': 'Cocina',

  // ── Danza ───────────────────────────────────────────────────────────────────
  'danza': 'Danza', 'danza moderna': 'Danza Moderna', 'hip hop': 'Hip Hop', 'hip-hop': 'Hip Hop',
  'danzas folclóricas': 'Danzas Folclóricas', 'danzas folcloricas': 'Danzas Folclóricas',
  'danza folclórica': 'Danzas Folclóricas', 'danza folclorica': 'Danzas Folclóricas',
  'folclor': 'Danzas Folclóricas', 'folclore': 'Danzas Folclóricas',
  'ballet': 'Ballet',

  // ── Teatro ──────────────────────────────────────────────────────────────────
  'teatro': 'Teatro', 'eventos': 'Teatro', 'show': 'Teatro',
  'espectaculo': 'Teatro', 'espectáculo': 'Teatro',
  'charlas': 'General', 'charlas y debates': 'General', 'debate': 'General', 'conversatorio': 'General',
  'conferencia': 'General', 'foro': 'General',

  // ── Música ──────────────────────────────────────────────────────────────────
  'musica': 'Música', 'música': 'Música', 'concierto': 'Música', 'banda': 'Música',
  'canto': 'Canto', 'coro': 'Canto', 'voz': 'Canto',
  'guitarra': 'Guitarra', 'piano': 'Piano', 'violin': 'Violín', 'violín': 'Violín',
  'bateria': 'Batería', 'batería': 'Batería',

  // ── Deportes ────────────────────────────────────────────────────────────────
  'deporte': 'Deportes', 'deportes': 'Deportes',
  'futbol': 'Fútbol', 'fútbol': 'Fútbol', 'soccer': 'Fútbol',
  'baloncesto': 'Baloncesto', 'basquet': 'Baloncesto', 'básquet': 'Baloncesto',
  'natacion': 'Natación', 'natación': 'Natación', 'natacion infantil': 'Natación',
  'tenis': 'Tenis', 'padel': 'Tenis',
  'gimnasia': 'Gimnasia', 'acrobacia': 'Gimnasia',
  'patinaje': 'Patinaje', 'skate': 'Patinaje', 'rollerblade': 'Patinaje',
  'karate': 'Artes Marciales', 'artes marciales': 'Artes Marciales',
  'judo': 'Artes Marciales', 'taekwondo': 'Artes Marciales',

  // ── Ciencias y Tecnología ───────────────────────────────────────────────────
  'ciencia': 'Ciencias', 'ciencias': 'Ciencias', 'steam': 'Ciencias',
  'experimentos': 'Experimentos', 'experimento': 'Experimentos', 'laboratorio': 'Experimentos',
  'astronomia': 'Astronomía', 'astronomía': 'Astronomía', 'planetas': 'Astronomía', 'universo': 'Astronomía',
  'tecnologia': 'Tecnología', 'tecnología': 'Tecnología',
  'robotica': 'Robótica', 'robótica': 'Robótica', 'robots': 'Robótica',
  'programacion': 'Programación', 'programación': 'Programación', 'coding': 'Programación',
  'diseño digital': 'Diseño Digital', 'diseno digital': 'Diseño Digital',

  // ── Naturaleza ──────────────────────────────────────────────────────────────
  'naturaleza': 'Naturaleza', 'aire libre': 'Naturaleza', 'parque': 'Naturaleza',
  'ecologia': 'Naturaleza', 'ecología': 'Naturaleza', 'medio ambiente': 'Naturaleza',
  'jardineria': 'Naturaleza', 'jardinería': 'Naturaleza', 'huerta': 'Naturaleza',

  // ── Campamentos ─────────────────────────────────────────────────────────────
  'campamento': 'Campamentos', 'campamentos': 'Campamentos',
  'campamentos de día': 'Campamentos de Día', 'campamentos de dia': 'Campamentos de Día',
  'campamentos vacacionales': 'Campamentos Vacacionales',

  // ── Idiomas ─────────────────────────────────────────────────────────────────
  'idiomas': 'Idiomas', 'ingles': 'Inglés', 'inglés': 'Inglés', 'english': 'Inglés',
  'frances': 'Francés', 'francés': 'Francés', 'french': 'Francés',
  'mandarin': 'Mandarín', 'mandarín': 'Mandarín', 'chino': 'Mandarín',

  // ── Lectura y Escritura ─────────────────────────────────────────────────────
  'lectura': 'Lectura', 'literatura': 'Lectura', 'cuentos': 'Lectura', 'cuento': 'Lectura',
  'escritura': 'Lectura', 'redaccion': 'Lectura', 'redacción': 'Lectura',

  // ── Desarrollo Personal ─────────────────────────────────────────────────────
  'desarrollo personal': 'Desarrollo Personal',
  'habilidades sociales': 'Desarrollo Personal', 'liderazgo': 'Desarrollo Personal',
  'inteligencia emocional': 'Desarrollo Personal', 'autoestima': 'Desarrollo Personal',
  'bienestar': 'Desarrollo Personal', 'salud mental': 'Desarrollo Personal',

  // ── Mindfulness y Yoga ──────────────────────────────────────────────────────
  'mindfulness': 'Mindfulness', 'meditacion': 'Mindfulness', 'meditación': 'Mindfulness',
  'relajacion': 'Mindfulness', 'relajación': 'Mindfulness',
  'yoga': 'Yoga Infantil', 'yoga infantil': 'Yoga Infantil',

  // ── Apoyo Académico ─────────────────────────────────────────────────────────
  'apoyo académico': 'Apoyo Académico', 'apoyo academico': 'Apoyo Académico',
  'tutorías': 'Tutorías', 'tutorias': 'Tutorías', 'refuerzo escolar': 'Tutorías',
  'matematicas': 'Matemáticas', 'matemáticas': 'Matemáticas', 'calculo': 'Matemáticas',

  // ── Fallback ─────────────────────────────────────────────────────────────────
  // 'general' explícito de Gemini → Arte y Creatividad (más útil que General vacío)
  'general': 'Arte y Creatividad',
  // Categorías sin bucket claro → General
  'género': 'General', 'genero': 'General', 'comunidad': 'General', 'community': 'General',
  'cultura': 'General', 'cultural': 'General',
};

function standardizeCategory(raw: string): string {
  const norm = raw.toLowerCase().trim();
  const mappedSlug = CATEGORY_MAP[norm];
  if (mappedSlug) return mappedSlug;

  // Logging de ambigüedad para categorías no mapeadas
  console.warn(`[data-pipeline] UNKNOWN_CATEGORY: "${norm}" (Fallback a General)`);
  return 'General';
}

function normalizeText(text: string | null): string {
  if (!text) return '';
  return text.trim()
             .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
             .replace(/\n{3,}/g, '\n\n'); // Limit line breaks to max 2
}

function normalizeTitle(title: string | null): string {
  if (!title || title === 'Sin título') return 'Sin título';
  const clean = title.trim().replace(/\s{2,}/g, ' ');
  // Remover ruido extremo promocional en títulos (ej. ¡¡¡URGENTE!!!, >>>)
  const sanitized = clean.replace(/^[¡!¿?_=>*-]+|[¡!¿?_=<*-]+$/g, '').trim();
  // Capitalize first letter strictly
  return sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
}

export type PipelineResult = {
  valid: boolean;
  reason?: string;
  data: ActivityNLPResult;
};

export function runDataPipeline(data: ActivityNLPResult): PipelineResult {
  // 1. Normalización de Cadenas
  const nTitle = normalizeTitle(data.title);
  const nDesc = normalizeText(data.description);
  
  // 2. Validación Obligatoria Base Crítica
  if (!nTitle || nTitle === 'Sin título' || nTitle.length < 5) return { valid: false, reason: 'title_invalid_or_missing', data };
  if (!nDesc || nDesc.length < 40) return { valid: false, reason: 'description_insufficient', data };
  if (!/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(nDesc)) return { valid: false, reason: 'invalid_chars_only', data };
  if (/^(haz clic|más info|link en bio)$/i.test(nDesc)) return { valid: false, reason: 'spam_detected', data };

  // 3. Estandarización de Categorías Enum Controlado
  const rawCats = data.categories || [];
  const standardCatsSet = new Set<string>();
  for (const c of rawCats) {
    if (c) standardCatsSet.add(standardilizeCategory(c));
  }
  // Si no mapeó nada válido o vino vacío
  if (standardCatsSet.size === 0) {
    standardCatsSet.add('General');
  }

  // 4. Estandarización de Edades y Fallbacks Seguros
  let minAge = (data.minAge !== undefined && data.minAge !== null) ? data.minAge : null;
  let maxAge = (data.maxAge !== undefined && data.maxAge !== null) ? data.maxAge : null;
  if (minAge !== null && maxAge !== null && minAge > maxAge) {
    // Falla de parseo invertida (Gemini Error)
    const temp = minAge; minAge = maxAge; maxAge = temp;
  }
  
  // 5. Enriquecimiento Rápido (Price y Environment)
  let pricePeriod = data.pricePeriod;
  let price = data.price;
  if (price === 0) {
    pricePeriod = 'FREE';
  } else if (price === null && pricePeriod === 'FREE') {
    price = 0;
  }

  let environment = data.environment;
  if (!environment) {
    const textToCheck = `${nTitle} ${nDesc} ${rawCats.join(' ')}`.toLowerCase();
    const isOutdoor = /aire libre|parque|excursión|excursion|campamento|naturaleza|piscina descubierta|bosque/.test(textToCheck);
    const isIndoor = /bajo techo|teatro|auditorio|taller|dentro de|museo|coliseo|estudio/.test(textToCheck);
    
    // Asignación simple para el bucket future proof
    if (isOutdoor && isIndoor) environment = 'MIXED';
    else if (isOutdoor) environment = 'OUTDOOR';
    else if (isIndoor) environment = 'INDOOR';
  }

  // Assign back
  const sanitizedData: ActivityNLPResult = {
    ...data,
    title: nTitle,
    description: nDesc,
    categories: Array.from(standardCatsSet),
    minAge,
    maxAge,
    price,
    pricePeriod,
    environment
  };

  return { valid: true, data: sanitizedData };
}

function standardilizeCategory(raw: string): string {
  return standardizeCategory(raw);
}
