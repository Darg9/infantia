// =============================================================================
// fallback-mapper.ts — Mapeo Cheerio → ActivityNLPResult cuando Gemini no está
//
// Estrategia conservadora:
//   - title:       og:title o <title> del HTML, o 'Sin título'
//   - description: primeros 300 chars del sourceText limpio
//   - categories:  inferidas por keywords del sourceText
//   - schedules:   fechas detectadas por extractDatesFromText (ya existente)
//   - confidenceScore: 0.4 (sin NLP) — no compite con datos de calidad
//   - Todo lo demás: null / defaults del schema
// =============================================================================

import * as cheerio from 'cheerio';
import type { ScrapedRawData, ActivityNLPResult } from '../types';
import type { ParseResult } from './parser.types';
import { extractDatesFromText } from '../utils/date-preflight';

// ── Blacklist anti-no-eventos (solo aplica en fallback Cheerio) ──────────────
// Páginas institucionales que no son eventos — se descartan poniendo confidence=0
const NON_EVENT_KEYWORDS = [
  'tratamiento de datos',
  'cómo llegar',
  'trabaja con nosotros',
  'sala de prensa',
  'política',
  'términos',
  'preguntas frecuentes',
  'pqrs',
  'quiénes somos',
  'contáctenos',
  'compra tu entrada',
  'nuestros servicios',
] as const;

/** Normaliza texto para comparación robusta: minúsculas + sin diacríticos. */
function normalizeText(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function isNonEvent(title: string): boolean {
  const t = normalizeText(title);
  return NON_EVENT_KEYWORDS.some((k) => t.includes(normalizeText(k)));
}

// ── Categorías inferibles por keywords ───────────────────────────────────────

const KEYWORD_CATEGORIES: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['música', 'concierto', 'banda', 'coro', 'orquesta'], category: 'Música' },
  { keywords: ['teatro', 'obra', 'dramaturg', 'escena', 'actuación'], category: 'Teatro' },
  { keywords: ['danza', 'baile', 'ballet', 'coreografía'], category: 'Danza' },
  { keywords: ['taller', 'workshop', 'curso', 'aprend', 'capacitación'], category: 'Talleres' },
  { keywords: ['deporte', 'fútbol', 'natación', 'atletismo', 'torneo'], category: 'Deporte' },
  { keywords: ['arte', 'pintura', 'dibujo', 'escultura', 'exposición', 'galería'], category: 'Arte' },
  { keywords: ['cine', 'película', 'film', 'cinemateca'], category: 'Cine' },
  { keywords: ['lectura', 'libro', 'biblioteca', 'literatur', 'cuento'], category: 'Literatura' },
  { keywords: ['ciencia', 'tecnología', 'robótica', 'stem', 'astronomía'], category: 'Ciencia' },
  { keywords: ['naturaleza', 'parque', 'jardín', 'ecología', 'ambiental'], category: 'Naturaleza' },
];

/** Infiere categorías del texto por keywords simples (sin NLP). */
function inferCategories(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const { keywords, category } of KEYWORD_CATEGORIES) {
    if (keywords.some((kw) => lower.includes(kw))) {
      found.push(category);
    }
  }
  return found.length > 0 ? found.slice(0, 3) : ['General'];
}

// ── Extracción de título desde HTML ──────────────────────────────────────────

function extractTitle(html: string): string {
  try {
    const $ = cheerio.load(html);
    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
    if (ogTitle) return ogTitle;
    const metaTitle = $('title').first().text().trim();
    if (metaTitle) return metaTitle;
    const h1 = $('h1').first().text().trim();
    if (h1) return h1;
  } catch { /* html inválido */ }
  return 'Sin título';
}

// ── schedules desde texto ─────────────────────────────────────────────────────

function buildSchedules(
  text: string,
): ActivityNLPResult['schedules'] {
  const dates = extractDatesFromText(text);
  if (dates.length === 0) return undefined;

  // Ordenar y tomar primeras 3 para no generar ruido
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime()).slice(0, 3);
  return sorted.map((d) => ({
    startDate: d.toISOString().substring(0, 10),
    endDate:   undefined,
    notes:     undefined,
  }));
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Convierte datos brutos de CheerioExtractor en un ActivityNLPResult mínimo.
 * Confidence baja (0.4) — indica origen fallback sin NLP.
 */
export function fallbackFromCheerio(raw: ScrapedRawData): ParseResult {
  const html     = raw.html ?? '';
  const text     = raw.sourceText ?? '';

  const title       = extractTitle(html) || 'Sin título';
  const description = text.slice(0, 300).trim();
  const categories  = inferCategories(text);
  const schedules   = buildSchedules(text);

  // Blacklist: páginas institucionales no-evento → confidence 0 (serán descartadas por el pipeline)
  const confidenceScore = isNonEvent(title) ? 0 : 0.4;

  // Extracción regex básica (precio y edad) para salvaguardar puntaje de ranking
  let price: number | undefined = undefined;
  let minAge: number | undefined = undefined;
  let maxAge: number | undefined = undefined;

  const textLower = normalizeText(text);

  if (/gratis|entrada libre|sin costo/.test(textLower)) {
    price = 0;
  }

  // Patrón "3 a 5 anos" / "5-10 anos" (usamos 'anos' porque normalizeText quita tildes/eñes)
  const ageMatch = textLower.match(/(\d{1,2})\s*(?:a|-)\s*(\d{1,2})\s*anos/);
  if (ageMatch) {
    minAge = parseInt(ageMatch[1], 10);
    maxAge = parseInt(ageMatch[2], 10);
  } else if (/ninos|infantil/.test(textLower)) {
    minAge = 3;
    maxAge = 12;
  }

  const result: ActivityNLPResult = {
    isActivity: true,
    title,
    description,
    categories,
    confidenceScore,
    schedules,
    minAge,
    maxAge,
    price,
    pricePeriod: undefined,
    currency:    'COP',
    audience:    'ALL',
    location:    undefined,
    environment: undefined,
    imageUrl:    raw.ogImage ?? undefined,
  };

  return { result, source: 'fallback' };
}
