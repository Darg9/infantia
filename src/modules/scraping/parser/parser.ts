// =============================================================================
// parser.ts — Orchestrator de parsing resiliente
//
// Expone dos funciones públicas:
//
//   parseActivity(html, url, analyzer)
//     Fase 3: intenta Gemini; si falla con error retryable (429/503/timeout)
//     usa fallbackFromCheerio para no perder la actividad.
//
//   discoverWithFallback(links, sourceUrl, analyzer)
//     Fase 2: intenta Gemini para filtrar qué URLs son actividades;
//     si falla con error retryable, devuelve TODOS los URLs (conservador —
//     cero pérdida de actividades) y registra el fallback en métricas.
// =============================================================================

import type { ActivityNLPResult, DiscoveredLink, ScrapedRawData } from '../types';
import type { GeminiAnalyzer } from '../nlp/gemini.analyzer';
import { CheerioExtractor } from '../extractors/cheerio.extractor';
import { fallbackFromCheerio } from './fallback-mapper';
import { isRetryableError, _incrementMetric } from './parser.types';
import type { ParseResult } from './parser.types';
import { createLogger } from '../../../lib/logger';
import { preFilterUrls } from '../../../lib/url-classifier';

const log = createLogger('scraping:parser');

// Extensiones binarias — mismo criterio que Stage 1 en gemini.analyzer.ts
const IMAGE_OR_BINARY_EXT = /\.(jpe?g|png|gif|webp|svg|bmp|tiff?|pdf|mp4|mp3|zip|doc[x]?|xls[x]?|ppt[x]?)$/i;

/**
 * Aplica los mismos filtros determinísticos que Stage 1 + Stage 2 de discoverActivityLinks.
 * Usado en el fallback cuando Gemini no está disponible para no mandar basura a Fase 3.
 */
function applyDiscoverPreFilters(links: DiscoveredLink[]): string[] {
  // Stage 1: query params + extensiones binarias + fragmentos puros + protocolos no-http
  const stage1 = links.filter((l) => {
    try {
      const u = new URL(l.url);
      if (!['http:', 'https:'].includes(u.protocol)) return false; // mailto:, tel:, javascript:
      if (u.search.length > 0) return false;                        // query params
      if (u.hash && u.pathname === '/' || u.hash.length > 0 && u.pathname === u.hash) return false; // hash-only
      if (IMAGE_OR_BINARY_EXT.test(u.pathname)) return false;       // archivos binarios
      return true;
    } catch {
      return false; // URL inválida → descartar
    }
  });

  // Stage 2: url-classifier score (threshold 45 — mismo que el analyze normal)
  const stage2 = preFilterUrls(stage1.map((l) => l.url), 45);
  return stage2.kept;
}

// ── Fase 3: parseActivity ─────────────────────────────────────────────────────

/**
 * Intenta extraer y analizar una URL con Gemini.
 * Si Gemini falla con error retryable, usa fallbackFromCheerio.
 * Si la extracción HTML falla, relanza el error (no es problema de Gemini).
 *
 * @param html        HTML ya extraído (viene de CheerioExtractor.extract)
 * @param url         URL original (para logs y referencia)
 * @param raw         ScrapedRawData completo (para fallback con ogImage)
 * @param analyzer    Instancia de GeminiAnalyzer
 */
export async function parseActivity(
  html: string,
  url: string,
  raw: ScrapedRawData,
  analyzer: Pick<GeminiAnalyzer, 'analyze'>,
): Promise<ParseResult> {
  try {
    const result: ActivityNLPResult = await analyzer.analyze(html, url);
    _incrementMetric('geminiOk');
    return { result, source: 'gemini' };
  } catch (err: unknown) {
    if (isRetryableError(err)) {
      log.warn(`[parser] Gemini no disponible para ${url} (retryable). Usando fallback Cheerio.`);
      _incrementMetric('fallbackUsed');
      return fallbackFromCheerio(raw);
    }
    // Error no retryable (e.g. HTML vacío, respuesta inválida) → propagar
    _incrementMetric('geminiErrors');
    throw err;
  }
}

// ── Fase 2: discoverWithFallback ──────────────────────────────────────────────

/**
 * Intenta usar Gemini para filtrar qué URLs son actividades.
 * Si Gemini falla con error retryable, devuelve TODOS los URLs como fallback
 * (estrategia conservadora: mejor procesar demás que perder actividades).
 *
 * @param links      Lista de DiscoveredLink del crawl
 * @param sourceUrl  URL de la página listado (para contexto de Gemini)
 * @param analyzer   Instancia de GeminiAnalyzer
 * @returns          Array de URL strings (ya filtrados o todos si fallback)
 */
export async function discoverWithFallback(
  links: DiscoveredLink[],
  sourceUrl: string,
  analyzer: Pick<GeminiAnalyzer, 'discoverActivityLinks'>,
): Promise<string[]> {
  if (links.length === 0) return [];

  try {
    const filtered = await analyzer.discoverActivityLinks(links, sourceUrl);
    _incrementMetric('discoverOk');
    return filtered;
  } catch (err: unknown) {
    if (isRetryableError(err)) {
      // Aplicar los mismos pre-filtros determinísticos (Stage 1 + Stage 2) que usa discoverActivityLinks.
      // Sin esto el fallback manda TODOS los links brutos (fragmentos, imágenes, wp-uploads) a Fase 3.
      const safeUrls = applyDiscoverPreFilters(links);
      log.warn(
        `[parser] Gemini no disponible para discover en ${sourceUrl} (retryable). ` +
        `Fallback conservador: ${safeUrls.length}/${links.length} URLs tras pre-filtros.`,
      );
      _incrementMetric('discoverFallback');
      return safeUrls;
    }
    // Error no retryable → propagar
    throw err;
  }
}

// ── Re-export helpers ─────────────────────────────────────────────────────────

export { fallbackFromCheerio } from './fallback-mapper';
export { isRetryableError, getParserMetrics, resetParserMetrics } from './parser.types';
export type { ParseResult } from './parser.types';
