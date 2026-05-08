import { ActivityNLPResult } from './types';

// =============================================================================
// CATEGORY STANDARDIZATION MAP
// Mapea ruido natural inferido por LLM hacia buckets definidos
// =============================================================================
const CATEGORY_MAP: Record<string, string> = {
  // Arte y Creatividad — incluye variantes genéricas + categorías propias de Idartes/SCRD
  'arte': 'Arte y Creatividad', 'artes': 'Arte y Creatividad',
  'arte y creatividad': 'Arte y Creatividad',
  'manualidades': 'Arte y Creatividad', 'pintura': 'Arte y Creatividad', 'dibujo': 'Arte y Creatividad',
  'talleres': 'Arte y Creatividad', 'taller': 'Arte y Creatividad', 'workshop': 'Arte y Creatividad',
  'artes audiovisuales': 'Arte y Creatividad', 'audiovisual': 'Arte y Creatividad', 'cine': 'Arte y Creatividad',
  // Lúdico — "Artes Lúdicas" en Idartes/SCRD: circo, magia, títeres, juegos creativos
  'lúdico': 'Arte y Creatividad', 'ludico': 'Arte y Creatividad',
  'artes lúdicas': 'Arte y Creatividad', 'artes ludicas': 'Arte y Creatividad',
  'danza': 'Danza', 'teatro': 'Teatro',
  'musica': 'Música', 'música': 'Música', 'concierto': 'Música',
  'deporte': 'Deportes', 'deportes': 'Deportes', 'futbol': 'Deportes', 'fútbol': 'Deportes',
  'natacion': 'Deportes', 'natación': 'Deportes', 'baloncesto': 'Deportes', 'gimnasia': 'Deportes', 'skate': 'Deportes',
  'karate': 'Artes Marciales', 'artes marciales': 'Artes Marciales',
  'ciencia': 'Ciencias', 'ciencias': 'Ciencias', 'steam': 'Ciencias',
  'tecnologia': 'Tecnología', 'tecnología': 'Tecnología', 'robotica': 'Tecnología', 'robótica': 'Tecnología',
  'programacion': 'Tecnología', 'programación': 'Tecnología',
  'aire libre': 'Naturaleza', 'naturaleza': 'Naturaleza', 'campamento': 'Naturaleza', 'parque': 'Naturaleza',
  'idiomas': 'Idiomas', 'ingles': 'Idiomas', 'inglés': 'Idiomas', 'frances': 'Idiomas', 'francés': 'Idiomas',
  'juegos': 'Arte y Creatividad', 'gamification': 'Arte y Creatividad', 'juegos de mesa': 'Arte y Creatividad',
  'lectura': 'Lectura', 'literatura': 'Lectura',
  'eventos': 'Teatro', 'show': 'Teatro', 'espectaculo': 'Teatro', 'espectáculo': 'Teatro',
  'general': 'Arte y Creatividad',
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
