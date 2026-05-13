import { ActivityNLPResult } from './types';

// =============================================================================
// CATEGORY STANDARDIZATION MAP — 7 CANÓNICAS (actualizado S68)
// Mapea el ruido inferido por el LLM directamente a las 7 categorías canónicas.
// REGLA: NUNCA añadir una categoría nueva aquí — todo debe mapear a una de las 7.
// =============================================================================
const CANONICAL_CATEGORIES = [
  'Música', 'Lectura', 'Ciencia y tec.',
  'Naturaleza', 'Deportes', 'Teatro y danza', 'Manualidades',
] as const;

const CATEGORY_MAP: Record<string, string> = {
  // ── Música ──────────────────────────────────────────────────────────────────
  'música': 'Música', 'musica': 'Música',
  'concierto': 'Música', 'banda': 'Música', 'canto': 'Música', 'coro': 'Música',
  'guitarra': 'Música', 'piano': 'Música', 'violin': 'Música', 'violín': 'Música',
  'bateria': 'Música', 'batería': 'Música', 'voz': 'Música',

  // ── Lectura ──────────────────────────────────────────────────────────────────
  'lectura': 'Lectura', 'literatura': 'Lectura', 'cuentos': 'Lectura', 'cuento': 'Lectura',
  'escritura': 'Lectura', 'redaccion': 'Lectura', 'redacción': 'Lectura',
  'poesia': 'Lectura', 'poesía': 'Lectura',
  'idiomas': 'Lectura', 'ingles': 'Lectura', 'inglés': 'Lectura', 'english': 'Lectura',
  'frances': 'Lectura', 'francés': 'Lectura', 'french': 'Lectura',
  'mandarin': 'Lectura', 'mandarín': 'Lectura', 'chino': 'Lectura',
  'apoyo académico': 'Lectura', 'apoyo academico': 'Lectura',
  'tutorías': 'Lectura', 'tutorias': 'Lectura', 'refuerzo escolar': 'Lectura',
  'desarrollo personal': 'Lectura', 'habilidades sociales': 'Lectura',
  'inteligencia emocional': 'Lectura', 'liderazgo': 'Lectura',
  // conversatorios/charlas → Lectura (contenido cultural intelectual)
  'conversatorio': 'Lectura', 'charlas': 'Lectura', 'debate': 'Lectura',
  'conferencia': 'Lectura', 'foro': 'Lectura', 'charlas y debates': 'Lectura',

  // ── Ciencia y tec. ───────────────────────────────────────────────────────────
  'ciencia': 'Ciencia y tec.', 'ciencias': 'Ciencia y tec.', 'steam': 'Ciencia y tec.',
  'experimentos': 'Ciencia y tec.', 'experimento': 'Ciencia y tec.',
  'astronomia': 'Ciencia y tec.', 'astronomía': 'Ciencia y tec.',
  'planetas': 'Ciencia y tec.', 'universo': 'Ciencia y tec.', 'planetario': 'Ciencia y tec.',
  'tecnologia': 'Ciencia y tec.', 'tecnología': 'Ciencia y tec.',
  'robotica': 'Ciencia y tec.', 'robótica': 'Ciencia y tec.', 'robots': 'Ciencia y tec.',
  'programacion': 'Ciencia y tec.', 'programación': 'Ciencia y tec.', 'coding': 'Ciencia y tec.',
  'diseño digital': 'Ciencia y tec.', 'diseno digital': 'Ciencia y tec.',
  'matematicas': 'Ciencia y tec.', 'matemáticas': 'Ciencia y tec.', 'calculo': 'Ciencia y tec.',
  'ciencia y tec.': 'Ciencia y tec.', 'ciencia y tecnología': 'Ciencia y tec.',

  // ── Naturaleza ───────────────────────────────────────────────────────────────
  'naturaleza': 'Naturaleza', 'aire libre': 'Naturaleza', 'parque': 'Naturaleza',
  'ecologia': 'Naturaleza', 'ecología': 'Naturaleza', 'medio ambiente': 'Naturaleza',
  'jardineria': 'Naturaleza', 'jardinería': 'Naturaleza', 'huerta': 'Naturaleza',
  'campamento': 'Naturaleza', 'campamentos': 'Naturaleza',
  'campamentos de día': 'Naturaleza', 'campamentos de dia': 'Naturaleza',
  'campamentos vacacionales': 'Naturaleza',

  // ── Deportes ─────────────────────────────────────────────────────────────────
  'deporte': 'Deportes', 'deportes': 'Deportes',
  'futbol': 'Deportes', 'fútbol': 'Deportes', 'soccer': 'Deportes',
  'baloncesto': 'Deportes', 'basquet': 'Deportes', 'básquet': 'Deportes',
  'natacion': 'Deportes', 'natación': 'Deportes', 'natacion infantil': 'Deportes',
  'tenis': 'Deportes', 'padel': 'Deportes',
  'gimnasia': 'Deportes', 'acrobacia': 'Deportes',
  'patinaje': 'Deportes', 'skate': 'Deportes', 'rollerblade': 'Deportes',
  'karate': 'Deportes', 'artes marciales': 'Deportes',
  'judo': 'Deportes', 'taekwondo': 'Deportes',
  'yoga': 'Deportes', 'yoga infantil': 'Deportes',
  'mindfulness': 'Deportes', 'meditacion': 'Deportes', 'meditación': 'Deportes',
  'bienestar': 'Deportes', 'salud mental': 'Deportes',

  // ── Teatro y danza ───────────────────────────────────────────────────────────
  'teatro': 'Teatro y danza', 'teatro y danza': 'Teatro y danza',
  'danza': 'Teatro y danza', 'danza moderna': 'Teatro y danza',
  'hip hop': 'Teatro y danza', 'hip-hop': 'Teatro y danza',
  'danzas folclóricas': 'Teatro y danza', 'danzas folcloricas': 'Teatro y danza',
  'danza folclórica': 'Teatro y danza', 'danza folclorica': 'Teatro y danza',
  'folclor': 'Teatro y danza', 'folclore': 'Teatro y danza',
  'ballet': 'Teatro y danza',
  'circo': 'Teatro y danza', 'títeres': 'Teatro y danza', 'titeres': 'Teatro y danza',
  'show': 'Teatro y danza', 'espectaculo': 'Teatro y danza', 'espectáculo': 'Teatro y danza',
  'eventos': 'Teatro y danza',
  // Artes Lúdicas Idartes/SCRD: circo, magia, títeres
  'lúdico': 'Teatro y danza', 'ludico': 'Teatro y danza',
  'artes lúdicas': 'Teatro y danza', 'artes ludicas': 'Teatro y danza',
  'magia': 'Teatro y danza',

  // ── Manualidades ─────────────────────────────────────────────────────────────
  'manualidades': 'Manualidades',
  'pintura': 'Manualidades', 'dibujo': 'Manualidades', 'pintura y dibujo': 'Manualidades',
  'cerámica': 'Manualidades', 'ceramica': 'Manualidades', 'barro': 'Manualidades',
  'cocina': 'Manualidades', 'gastronomia': 'Manualidades', 'gastronomía': 'Manualidades',
  'reposteria': 'Manualidades', 'repostería': 'Manualidades',
  'fotografía': 'Manualidades', 'fotografia': 'Manualidades',
  'comics': 'Manualidades', 'ilustracion': 'Manualidades', 'ilustración': 'Manualidades',
  'escultura': 'Manualidades', 'modelado': 'Manualidades',

  // ── Genéricos — Arte y Creatividad (contenedor temporal) ────────────────────
  // Gemini devuelve categorías vagas → Arte y Creatividad como staging area.
  // Estas actividades quedan en PENDING_REVIEW hasta asignación manual o
  // reclasificación automática en el próximo ciclo de mantenimiento.
  'arte': 'Arte y Creatividad', 'artes': 'Arte y Creatividad',
  'arte y creatividad': 'Arte y Creatividad',
  'artes audiovisuales': 'Arte y Creatividad', 'audiovisual': 'Arte y Creatividad',
  'cine': 'Arte y Creatividad',
  'talleres': 'Arte y Creatividad', 'taller': 'Arte y Creatividad', 'workshop': 'Arte y Creatividad',
  'juegos': 'Arte y Creatividad', 'gamification': 'Arte y Creatividad', 'juegos de mesa': 'Arte y Creatividad',
  'general': 'Arte y Creatividad',
  // Sin bucket claro → Arte y Creatividad
  'género': 'Arte y Creatividad', 'genero': 'Arte y Creatividad',
  'comunidad': 'Arte y Creatividad', 'community': 'Arte y Creatividad',
  'cultura': 'Arte y Creatividad', 'cultural': 'Arte y Creatividad',
  'laboratorio': 'Arte y Creatividad',
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
