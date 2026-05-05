import { DiscoveredLink } from './types';

export type RankedCandidate = DiscoveredLink & {
  score: number;
  signals: Record<string, number>;
};

// Expresiones regulares para scoring (ligeras y deterministas)
const DATE_RE = /\b(\d{1,2}\s*(de\s*)?(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*|\d{1,2}\/\d{1,2}|hoy|mañana|sábado|domingo)\b/i;
const EVENT_RE = /\b(taller|evento|feria|inscripci[oó]n|agenda|programaci[oó]n|funci[oó]n|concierto|exposici[oó]n|charla|conversatorio|festival)\b/i;
const TIME_RE = /\b(\d{1,2}:\d{2}|am|pm)\b/i;

// Señales negativas: páginas estáticas / institucionales / legales
const NEG_RE = /\b(permanente|siempre abierto|visítanos|quienes somos|contacto|noticias|directorio|convocatoria|licitaci[oó]n|empleo|pol[ií]tica|privacidad)\b/i;

// Patrones de URL: rutas de evento (fuerte señal de actividad)
const URL_EVENT_RE = /(\/evento\/|\/agenda\/|\/eventos\/|\/programate\/|\/actividad\/)/i;

// Fecha en URL: /año/mes/ o /año-mes-día/ — señal de contenido con fecha específica
const URL_DATE_RE = /\/\d{4}\/\d{2}(?:\/\d{2})?\/|\/\d{4}-\d{2}-\d{2}\//;

/**
 * Score de frescura basado en el <lastmod> del sitemap.
 * +2 si actualizado hace ≤7 días  (muy fresco → evento próximo o en curso)
 * +1 si actualizado hace ≤30 días (fresco)
 * 0  sin lastmod o > 30 días
 */
function freshnessScore(lastmod?: string): number {
  if (!lastmod) return 0;
  const ms = new Date(lastmod).getTime();
  if (isNaN(ms)) return 0;
  const days = (Date.now() - ms) / (1000 * 60 * 60 * 24);
  if (days <= 7) return 2;
  if (days <= 30) return 1;
  return 0;
}

/**
 * Fisher-Yates shuffle — devuelve una copia mezclada, no muta el original.
 */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Aplica el heurístico a un candidato individual.
 */
function scoreOne(link: DiscoveredLink): RankedCandidate {
  let s = 0;
  const signals: Record<string, number> = {};

  // El texto incluye título y snippet si los extrajo Cheerio, o solo URL en el sitemap
  const text = `${link.title ?? ''} ${link.snippet ?? ''} ${link.url}`;

  if (DATE_RE.test(text)) {
    s += 3;
    signals.hasDate = 3;
  }

  if (EVENT_RE.test(text)) {
    s += 3;
    signals.hasEventWord = 3;
  }

  if (TIME_RE.test(text)) {
    s += 1;
    signals.hasTime = 1;
  }

  if (URL_EVENT_RE.test(link.url)) {
    s += 2;
    signals.urlPattern = 2;
  }

  if (URL_DATE_RE.test(link.url)) {
    s += 2;
    signals.urlDate = 2;
  }

  if ((link.title?.length ?? 0) + (link.snippet?.length ?? 0) > 40) {
    s += 1;
    signals.length = 1;
  }

  if (NEG_RE.test(text)) {
    s -= 2;
    signals.negativeStatic = -2;
  }

  // Señal de frescura desde sitemap lastmod (solo fuentes XML)
  const fresh = freshnessScore(link.lastmod);
  if (fresh > 0) {
    s += fresh;
    signals.freshness = fresh;
  }

  return { ...link, score: s, signals };
}

/**
 * Toma una lista de URLs descubiertas y devuelve las mejores según el presupuesto.
 *
 * Estrategia ε-greedy (ε=0.20):
 *   80% explotación → top-K por score  (evita perder actividades obvias)
 *   20% exploración → muestra aleatoria del tail (evita missed outliers con score 0)
 *
 * @param items   Links extraídos en Fase 1 (Cheerio o Sitemap)
 * @param opts    maxPagesLimit = presupuesto Gemini estricto
 */
export function rankCandidates(
  items: DiscoveredLink[],
  opts?: { maxPagesLimit?: number },
): {
  rankedPool: RankedCandidate[];
  selected: RankedCandidate[];
  maxScore: number;
  zeroScorePct: number;
} {
  const K = opts?.maxPagesLimit ?? 10;
  // Pool de exploración: hasta 2× el presupuesto (capped a all items)
  const maxCandidates = Math.min(items.length, Math.ceil(K * 2));

  // Rankear todos
  const ranked = items.map(scoreOne).sort((a, b) => b.score - a.score);

  const maxScore = ranked.length > 0 ? ranked[0].score : 0;
  const zeroScorePct = ranked.length > 0
    ? parseFloat(((ranked.filter((x) => x.score <= 0).length / ranked.length) * 100).toFixed(1))
    : 0;

  // rankedPool = ventana de exploración completa (shadow usa esto para comparar)
  const rankedPool = ranked.slice(0, maxCandidates);

  // ε-greedy selection
  const epsilon = 0.2;
  const exploreCount = Math.floor(K * epsilon);           // 20% exploración
  const exploitCount = K - exploreCount;                  // 80% explotación

  const topK = ranked.slice(0, K);                        // candidatos de explotación
  const tail  = ranked.slice(K, maxCandidates);           // pool de exploración

  const explored = shuffle(tail).slice(0, exploreCount);
  const selected = [...topK.slice(0, exploitCount), ...explored];

  return { rankedPool, selected, maxScore, zeroScorePct };
}
