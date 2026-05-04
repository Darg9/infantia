import { DiscoveredLink } from './types';

export type RankedCandidate = DiscoveredLink & {
  score: number;
  signals: Record<string, number>;
};

// Expresiones regulares para scoring (ligeras y deterministas)
const DATE_RE = /\b(\d{1,2}\s*(de\s*)?(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*|\d{1,2}\/\d{1,2}|hoy|mañana|sábado|domingo)\b/i;
const EVENT_RE = /\b(taller|evento|feria|inscripci[oó]n|agenda|programaci[oó]n|funci[oó]n|concierto|exposici[oó]n|charla|conversatorio|festival)\b/i;
const TIME_RE = /\b(\d{1,2}:\d{2}|am|pm)\b/i;
const NEG_RE = /\b(permanente|siempre abierto|visítanos|quienes somos|contacto|noticias|directorio)\b/i;
const URL_EVENT_RE = /(\/evento\/|\/agenda\/|\/eventos\/|\/programate\/|\/actividad\/)/i;

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
  
  if ((link.title?.length ?? 0) + (link.snippet?.length ?? 0) > 40) {
    s += 1;
    signals.length = 1;
  }
  
  if (NEG_RE.test(text)) {
    s -= 2;
    signals.negativeStatic = -2;
  }

  return { ...link, score: s, signals };
}

/**
 * Toma una lista de URLs descubiertas y devuelve las mejores según el presupuesto.
 * Implementa over-selection: rankea un poco más de las que procesaremos finalmente.
 * 
 * @param items Links extraídos en Fase 1 (Cheerio o Sitemap)
 * @param opts limit = el presupuesto estricto (`maxPages`), se aplica over-selection interno.
 */
export function rankCandidates(
  items: DiscoveredLink[],
  opts?: { maxPagesLimit?: number }
): {
  rankedPool: RankedCandidate[];
  selected: RankedCandidate[];
  maxScore: number;
} {
  const budget = opts?.maxPagesLimit ?? 10;
  const maxCandidates = Math.ceil(Math.min(budget * 1.5, budget + 5));

  // Rankear todos
  const ranked = items.map(scoreOne).sort((a, b) => b.score - a.score);
  
  const maxScore = ranked.length > 0 ? ranked[0].score : 0;

  // 1. Ranking con over-selection (exploración)
  const rankedPool = ranked.slice(0, maxCandidates);

  // 2. Selección final (explotación, respeta budget estricto de Gemini)
  // Nota: limitamos el budget final basándonos en la pool explorada.
  const selected = rankedPool.slice(0, budget);

  return { rankedPool, selected, maxScore };
}
