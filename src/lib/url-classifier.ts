// url-classifier.ts
// Pre-filter URLs antes de enviar a Gemini NLP
// Detecta patrones de URLs no productivas (categorías, archivos, infraestructura)
// Objetivo: Reducir carga Gemini + mejorar tasa de actividades extraídas

/**
 * Dominios que NUNCA deben indexarse como fuente de actividades.
 * Comerciales, redes sociales, mensajería, etc.
 */
const BLOCKED_DOMAINS = new Set([
  // Agencias y comercios digitales
  'agenciadigitalamd.com',

  // Mensajería
  'api.whatsapp.com',
  'whatsapp.com',
  'telegram.me',
  't.me',

  // Redes sociales (se maneja por separado vía PlaywrightExtractor, no Cheerio)
  'linkedin.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'facebook.com',

  // Plataformas de video
  'youtube.com',
  'youtu.be',
  'vimeo.com',

  // Compras y marketplaces
  'mercadolibre.com',
  'amazon.com',
  'rappi.com',
]);

/**
 * Patrones regex que indican URL NO productiva
 * (no contiene información de actividad)
 */
const NON_PRODUCTIVE_PATTERNS = [
  // Categorías y filtros (con y sin acento)
  /\/categor[ií]?[ao]\//i,
  /\/category\//i,
  /\/tag\//i,
  /\/etiqueta\//i,
  /\/filtro\//i,
  /\/filter\//i,
  /\/search\?/i,
  /\/buscar\?/i,

  // Archivos y recursos binarios
  /\.(pdf|jpg|jpeg|png|gif|zip|doc|docx|xlsx|xls|mp3|mp4)$/i,

  // Páginas de infraestructura
  /\/about\//i,
  /\/contact\//i,
  /\/contacto\//i,
  /\/privacy\//i,
  /\/terminos\//i,
  /\/terms\//i,
  /\/sitemap/i,
  /\/robots\.txt/i,
  /\/admin\//i,
  /\/login\//i,
  /\/signup\//i,
  /\/register\//i,

  // Institucional / Ruido específico
  /\/nosotros(\/|$)/i,
  /\/escuelas-leo(\/|$)/i,
  /\/escenarios-moviles(\/|$)/i,
  /\/mas-cultura-local(\/|$)/i,
  /\/explora-el-jardin(\/|$)/i,
  /\/recursos-educativos(\/|$)/i,
  /\/reservas(\/|$)/i,
  /\/buscador/i,
  /\/participacion/i,
  /\/sondeos/i,
  /\/home-cinemateca/i,
  /\/visita-cinemateca/i,
  /\/institucional/i,

  // Archivos y listados (no eventos)
  /\/archive\//i,
  /\/archivo\//i,
  /\/all-events\//i,
  /\/events\?/i,

  // Patrones de paginación sin contenido específico
  /\?page=\d+$/,
  /\/page\/\d+\/?$/,
  /\?p=\d+$/,

  // Parámetros genéricos sin valores específicos
  /\?id=$/,
  /\?slug=$/,
  /\?uid=$/,
];

/**
 * Patrones que indican URL POTENCIALMENTE productiva
 * (probabilidad de ser actividad/evento)
 */
const PRODUCTIVE_INDICATORS = [
  // Palabras clave de actividades
  /evento|event|actividad|activity|workshop|taller|clase|class|curso|course/i,
  /concert|concierto|show|festival|feria|fair|exhibition|exposici[óo]n/i,
  /camp|campamento|camp|retiro|retreat|viaje|trip|tour|excurs/i,
  /deporte|sport|juego|game|competencia|championship|torneo|tournament/i,
  /teatro|theatre|cine|cinema|película|film|espectáculo|show/i,
  /museo|museum|galería|gallery|biblioteca|library|parque|park/i,

  // Fechas (indica evento temporal)
  /\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
  /\d{2}\/\d{2}\/\d{4}/, // DD/MM/YYYY
  /\d{1,2}-\w+-\d{4}/, // DD-Mon-YYYY

  // Horarios
  /\d{1,2}:\d{2}|clock|hora|time|horario/i,
];

/**
 * Clasifica una URL por su probabilidad de ser actividad
 * Retorna score 0-100
 */
export function classifyUrlProductivity(url: string): {
  score: number;
  isProductive: boolean;
  reason: string;
} {
  // Normalizar URL
  const normalized = url.toLowerCase().trim();

  // 0. Rechazar dominios bloqueados explícitamente
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    if (BLOCKED_DOMAINS.has(hostname)) {
      return {
        score: 0,
        isProductive: false,
        reason: `Blocked domain: ${hostname}`,
      };
    }
  } catch { /* url inválida */ }

  // 1. Penalizar patrones NO productivos (score 0-20)
  for (const pattern of NON_PRODUCTIVE_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        score: 0,
        isProductive: false,
        reason: `Matches non-productive pattern: ${pattern.source}`,
      };
    }
  }

  // 2. Reward patrones productivos
  let score = 50; // baseline score
  let matchCount = 0;

  for (const pattern of PRODUCTIVE_INDICATORS) {
    if (pattern.test(normalized)) {
      matchCount++;
      score += 10;
    }
  }

  // 3. Penalizar si URL es demasiado genérica
  const pathParts = new URL(url, 'https://example.com').pathname.split('/').filter(p => p.length > 0);
  if (pathParts.length === 0) {
    score -= 20; // Homepage sin path específico
  } else if (pathParts.length === 1 && pathParts[0].length < 5) {
    score -= 10; // Path muy corto
  }

  // 4. Bonus: URLs con ID específico en path o query
  if (/\/\d+\/?$|[?&]id=\d+|[?&]slug=|[?&]event|[?&]activity/.test(normalized)) {
    score += 15;
  }

  // Clamp score 0-100
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    isProductive: score >= 45, // threshold: 45/100
    reason: `Score ${score}: ${matchCount} productive indicators matched`,
  };
}

/**
 * Filtra URLs antes de Gemini basado en productivity score
 * @param urls URLs a filtrar
 * @param threshold Score mínimo (default: 45)
 * @returns {kept: URL[], filtered: URL[], stats}
 */
export function preFilterUrls(
  urls: string[],
  threshold = 45,
): {
  kept: string[];
  filtered: string[];
  stats: {
    total: number;
    kept: number;
    filtered: number;
    reductionPct: number;
    scores: Array<{ url: string; score: number; reason: string }>;
  };
} {
  const kept: string[] = [];
  const filtered: string[] = [];
  const scores: Array<{ url: string; score: number; reason: string }> = [];

  for (const url of urls) {
    const classification = classifyUrlProductivity(url);
    scores.push({ url, score: classification.score, reason: classification.reason });

    if (classification.score >= threshold) {
      kept.push(url);
    } else {
      filtered.push(url);
    }
  }

  return {
    kept,
    filtered,
    stats: {
      total: urls.length,
      kept: kept.length,
      filtered: filtered.length,
      reductionPct: urls.length > 0 ? Math.round((filtered.length / urls.length) * 100) : 0,
      scores,
    },
  };
}

/**
 * Tier de productividad de URL (para logging/analytics)
 */
export function getProductivityTier(score: number): 'HIGH' | 'MEDIUM' | 'LOW' | 'REJECT' {
  if (score >= 70) return 'HIGH';
  if (score >= 45) return 'MEDIUM';
  if (score >= 20) return 'LOW';
  return 'REJECT';
}
