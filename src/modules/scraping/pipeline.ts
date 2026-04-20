import { ActivityNLPResult, BatchPipelineResult, InstagramPipelineResult, ScrapedRawData } from './types';
import { CheerioExtractor } from './extractors/cheerio.extractor';
import { PlaywrightExtractor, InstagramExtractOptions } from './extractors/playwright.extractor';
import { GeminiAnalyzer } from './nlp/gemini.analyzer';
import { ScrapingCache } from './cache';
import { ScrapingStorage } from './storage';
import { ScrapingLogger } from './logger';
import { createLogger } from '../../lib/logger';
import { fetchWithFallback, updateSourceHealth, shouldSkipSource } from './resilience';
import { evaluatePreflight, getPreflightStats, resetPreflightStats } from './utils/date-preflight';
import { savePreflightLog } from './utils/preflight-db';
import { parseActivity, discoverWithFallback, getParserMetrics, resetParserMetrics } from './parser/parser';
import { FEATURE_FLAGS } from '@/config/feature-flags';
import { prisma } from '../../lib/db';
import { evaluateActivityGate } from './quality/activity-gate';

const log = createLogger('scraping:pipeline');

// ── Heurísticas pre-fetch ─────────────────────────────────────────────────────
// Descartan URLs obsoletas antes de hacer peticiones de red y consumir cuota Gemini.

const MAX_LASTMOD_AGE_DAYS = 60;

/**
 * Descarta URLs cuyo path contiene un año ya transcurrido: /2023/, /2024/, etc.
 * Dinámico — se actualiza solo cada 1 de enero sin cambios de código.
 */
export function isOldByUrl(url: string): boolean {
  const match = url.match(/\/(\d{4})\//);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  return year < new Date().getFullYear();
}

/**
 * Descarta URLs cuyo <lastmod> del sitemap supera MAX_LASTMOD_AGE_DAYS días.
 * Solo aplica a fuentes XML con lastmod; sin lastmod → no descarta (conservador).
 */
export function isOldByLastmod(lastmod?: string): boolean {
  if (!lastmod) return false;
  const ms = new Date(lastmod).getTime();
  if (isNaN(ms)) return false;
  const ageDays = (Date.now() - ms) / (1000 * 60 * 60 * 24);
  return ageDays > MAX_LASTMOD_AGE_DAYS;
}

export class ScrapingPipeline {
  private extractor: CheerioExtractor;
  private playwrightExtractor: PlaywrightExtractor | null = null;
  private analyzer: GeminiAnalyzer;
  private cache: ScrapingCache;
  private storage: ScrapingStorage | null;
  private logger: ScrapingLogger | null;
  private readonly cityName: string;
  private readonly verticalSlug: string;

  constructor(options?: { saveToDb?: boolean; cityName?: string; verticalSlug?: string }) {
    this.extractor = new CheerioExtractor();
    this.analyzer = new GeminiAnalyzer();
    this.cache = new ScrapingCache();
    this.storage = options?.saveToDb ? new ScrapingStorage() : null;
    this.logger = options?.saveToDb ? new ScrapingLogger() : null;
    this.cityName = options?.cityName ?? 'Bogotá';
    this.verticalSlug = options?.verticalSlug ?? 'kids';
  }

  async runPipeline(url: string, sourceHost?: string, opts?: { skipPreflight?: boolean }): Promise<ActivityNLPResult> {
    log.info(`1. Iniciando extracción resiliente desde: ${url}`);
    
    let htmlContent = '';
    const start = Date.now();
    try {
      const fallbackResult = await fetchWithFallback(url, 'WEBSITE', {
        cheerio: () => this.extractor,
        playwright: () => {
          if (!this.playwrightExtractor) this.playwrightExtractor = new PlaywrightExtractor();
          return this.playwrightExtractor;
        }
      });
      htmlContent = fallbackResult.data;
      
      if (sourceHost) {
        await updateSourceHealth(sourceHost, { success: true, responseTimeMs: fallbackResult.responseTime });
      }
    } catch (err: any) {
      log.error(`[PIPELINE] Falló la extracción con fallbacks agotados: ${err.message}`);
      if (sourceHost) {
        await updateSourceHealth(sourceHost, { success: false, responseTimeMs: Date.now() - start });
      }
      throw new Error(`[PIPELINE] Extracción abortada: ${err.message}`);
    }

    const textLength = htmlContent.length;
    log.info(`2. Extracción exitosa. Longitud de contenido extraído: ${textLength} caracteres`);

    // sourceText: texto limpio sin HTML tags (para Gemini y preflight de fechas)
    // htmlContent puede ser HTML completo (Cheerio) o texto (Playwright)
    const sourceText = CheerioExtractor.textFromHtml(htmlContent);

    // ── Pre-filtro de fechas: evitar NLP en eventos claramente pasados ─────────
    // Skip inteligente: si la URL ya está en caché y no requiere re-proceso,
    // omitimos el Date Preflight para ahorrar cuota Gemini de discovery.
    if (opts?.skipPreflight) {
      log.info('[DATE-PREFLIGHT] Omitido — URL ya en caché (re-proceso con Gemini)');
    } else {
      const preflight = evaluatePreflight(sourceText);

      // Persistir resultado en date_preflight_logs (fire-and-forget)
      void savePreflightLog({ sourceId: sourceHost ?? null, url, result: preflight });

      if (preflight.skip) {
        log.info('[DATE-PREFLIGHT] Evento descartado — NLP omitido', {
          url,
          decision:     'skip',
          reason:       preflight.reason,
          dates_found:  preflight.datesFound,
          matched_text: preflight.matchedText,
        });
        return {
          title:           'Sin título',
          description:     '',
          categories:      ['General'],
          currency:        'COP',
          audience:        'ALL',
          confidenceScore: 0,
        } as ActivityNLPResult;
      }
      log.info('[DATE-PREFLIGHT] Enviando a Gemini', {
        url,
        decision:     'process',
        reason:       preflight.reason,
        dates_found:  preflight.datesFound,
        matched_text: preflight.matchedText,
      });
    }

    log.info(`3. Enviando a NLP (Gemini) para estructurar datos...`);

    // Construimos ScrapedRawData para que el fallback mapper tenga contexto.
    // html: contenido completo (con tags) para que fallback-mapper encuentre <title>/<h1>
    // sourceText: texto limpio (sin tags) para Gemini (menos tokens) y descripción fallback
    const rawForFallback: ScrapedRawData = {
      url,
      html:        htmlContent,   // HTML completo → extractTitle() encuentra <title>/<h1>
      sourceText,                  // texto limpio → descripción fallback legible
      extractedAt: new Date(),
      status:      'SUCCESS',
    };

    const parsed = FEATURE_FLAGS.PARSER_FALLBACK_ENABLED
      ? await parseActivity(sourceText, url, rawForFallback, this.analyzer)
      : { result: await this.analyzer.analyze(sourceText, url), source: 'gemini' as const };

    if (parsed.source === 'fallback') {
      log.warn(`[PARSER] Actividad extraída con fallback Cheerio (Gemini no disponible): ${url}`);
    }
    log.info(`4. Análisis completado (source=${parsed.source}) con confianza: ${parsed.result.confidenceScore}`);

    // Propagar origen del parser para threshold diferenciado en el guardado
    return { ...parsed.result, parserSource: parsed.source };
  }

  async runBatchPipeline(listingUrl: string, opts: { maxPages?: number; sitemapPatterns?: string[]; concurrency?: number } = {}): Promise<BatchPipelineResult> {
    const { maxPages = 50, sitemapPatterns = [], concurrency = 1 } = opts;
    resetPreflightStats();
    resetParserMetrics();

    const host = new URL(listingUrl).hostname.replace('www.', '');
    const { skip, reason } = await shouldSkipSource(host);
    if (skip) {
      log.warn(`Abortando BatchPipeline. Fuente ${host} está penalizada con status CRITICAL o por auto-recovery. Motivo: ${reason}`);
      return { sourceUrl: listingUrl, discoveredLinks: 0, filteredLinks: 0, results: [] };
    }

    log.info(`\n[BATCH] ========== INICIO BATCH PIPELINE ==========`);
    log.info(`URL de listado: ${listingUrl}`);
    log.info(`Cache: ${this.cache.size} URLs ya scrapeadas`);

    // Logging: obtener o crear fuente y empezar log
    let logId: string | null = null;
    let sourceId: string | null = null;
    if (this.logger) {
      try {
        const cityId = await this.getCityId(this.cityName);
        const verticalId = await this.getVerticalId(this.verticalSlug);
        if (!cityId || !verticalId) {
          log.warn('Logger deshabilitado: cityId o verticalId no encontrados en BD.');
        } else {
          sourceId = await this.logger.getOrCreateSource({
            name: new URL(listingUrl).hostname.replace('www.', ''),
            url: listingUrl,
            platform: 'WEBSITE',
            scraperType: 'cheerio-batch',
            cityId,
            verticalId,
          });
          logId = await this.logger.startRun(sourceId);
          log.info(`Logger: sourceId=${sourceId}, logId=${logId}`);
        }
      } catch (err: any) {
        log.warn(`Logger init error (non-fatal): ${err?.message ?? String(err)}`);
      }
    }

    // Sincronizar cache desde BD antes de filtrar (evita re-scrapear en otra máquina)
    const cacheSource = new URL(listingUrl).hostname.replace('www.', '');
    this.cache.setSource(cacheSource);  // fix: entries se guardan con el hostname correcto
    await this.cache.syncFromDb(cacheSource);

    // Fase 1: Extraer links de TODAS las páginas del listado
    log.info(`Fase 1: Extrayendo links (con paginación automática)...`);

    // Detección automática de sitemap XML
    const isSitemap = listingUrl.includes('sitemap') && (listingUrl.endsWith('.xml') || listingUrl.includes('.xml'));
    let allLinks = isSitemap
      ? await this.extractor.extractSitemapLinks(listingUrl, sitemapPatterns)
      : await this.extractor.extractLinksAllPages(listingUrl, maxPages);

    const discoveredCount = allLinks.length;
    log.info(`Links totales encontrados: ${discoveredCount}`);

    // ── Heurísticas pre-fetch (antes de Gemini) ───────────────────────────────
    // Recortan volumen sin red ni cuota: URLs de años pasados y páginas no actualizadas
    if (allLinks.length > 0) {
      const urlOld     = allLinks.filter((l) => isOldByUrl(l.url)).length;
      const lastmodOld = allLinks.filter((l) => !isOldByUrl(l.url) && isOldByLastmod(l.lastmod)).length;
      allLinks = allLinks.filter((l) => !isOldByUrl(l.url) && !isOldByLastmod(l.lastmod));
      if (urlOld + lastmodOld > 0) {
        log.info(`[HEURISTICS] ↓${urlOld} por año en URL + ↓${lastmodOld} por lastmod > ${MAX_LASTMOD_AGE_DAYS}d. Restantes: ${allLinks.length}`);
      }
    }
    const afterHeuristicsCount = allLinks.length;

    // SPI — Sitemap Pre-Index: índice url→lastmod para filtrar ANTES del fetch
    // Solo disponible en fuentes XML (las únicas que incluyen <lastmod>)
    const lastmodIndex = new Map<string, string>();
    if (isSitemap) {
      for (const link of allLinks) {
        if (link.lastmod) lastmodIndex.set(link.url, link.lastmod);
      }
      if (lastmodIndex.size > 0) {
        log.info(`[SPI] Índice lastmod construido: ${lastmodIndex.size}/${allLinks.length} URLs con lastmod`);
      }
    }

    // Fallback a Playwright si Cheerio no encontró links (SPA / JS-rendered)
    if (allLinks.length === 0 && !isSitemap) {
      log.warn('Cheerio no encontró links. Intentando con Playwright (SPA fallback)...');
      if (!this.playwrightExtractor) {
        this.playwrightExtractor = new PlaywrightExtractor();
      }
      try {
        allLinks = await this.playwrightExtractor.extractWebLinks(listingUrl);
        log.info(`Playwright encontró: ${allLinks.length} links`);
      } catch (err: any) {
        log.error(`Playwright también falló: ${err.message}`);
      }
    }

    if (allLinks.length === 0) {
      log.warn('No se encontraron links ni con Cheerio ni con Playwright.');
      if (this.logger && logId && sourceId) {
        await this.logger.completeRun(logId, { itemsFound: 0, itemsNew: 0, itemsUpdated: 0, itemsDuplicated: 0, errorMessage: 'No links found' });
        await this.logger.updateSourceStatus(sourceId, 'FAILED' as any, 0);
      }
      return { sourceUrl: listingUrl, discoveredLinks: 0, filteredLinks: 0, results: [] };
    }

    // Fase 2: Filtrar con Gemini cuáles son actividades
    log.info(`Fase 2: Filtrando links con IA... (fallback=${FEATURE_FLAGS.PARSER_FALLBACK_ENABLED})`);
    const activityUrls = FEATURE_FLAGS.PARSER_FALLBACK_ENABLED
      ? await discoverWithFallback(allLinks, listingUrl, this.analyzer)
      : await this.analyzer.discoverActivityLinks(allLinks, listingUrl);
    log.info(`Links identificados como actividades: ${activityUrls.length}`);

    if (activityUrls.length === 0) {
      log.warn('Gemini no identificó ningún link como actividad.');
      if (this.logger && logId && sourceId) {
        await this.logger.completeRun(logId, { itemsFound: 0, itemsNew: 0, itemsUpdated: 0, itemsDuplicated: 0, metadata: { discoveredLinks: allLinks.length } });
        await this.logger.updateSourceStatus(sourceId, 'SUCCESS' as any, 0);
      }
      return { sourceUrl: listingUrl, discoveredLinks: allLinks.length, filteredLinks: 0, results: [] };
    }

    // ── needsReparse: URLs en caché marcadas para re-proceso con Gemini ─────────
    // Son URLs que en un run anterior se procesaron con Cheerio fallback (confidence < 0.5)
    // y no se guardaron. Se re-procesan aquí junto con URLs nuevas pero:
    //   - skip Date Preflight (ya sabemos que son actividades válidas)
    //   - solo si Gemini está disponible (de lo contrario el loop las omite)
    const reparseUrls = new Set(this.cache.getReparseUrls(activityUrls));
    if (reparseUrls.size > 0) {
      log.info(`[REPARSE] ${reparseUrls.size} URLs marcadas para re-proceso con Gemini (fallback previo, sin guardar)`);
    }

    // Fase 2.5: Filtrar URLs ya procesadas — doble fuente de verdad
    // 1ª capa: SPI (sitemap) o filterNew (no-sitemap)
    //   SPI: skip si url en cache Y lastmod ≤ scrapedAt (sin cambios confirmados)
    //   filterNew: skip si url en cache (comportamiento original)
    let afterCache: string[];
    if (isSitemap && lastmodIndex.size > 0) {
      const spiEntries = activityUrls.map((url) => ({ url, lastmod: lastmodIndex.get(url) }));
      const { urls, spiSkipped } = this.cache.filterSPI(spiEntries);
      // Las URLs marcadas para re-proceso siempre pasan, aunque el SPI las saltaría
      const reparseNotInSpi = [...reparseUrls].filter((u) => !urls.includes(u));
      afterCache = [...urls, ...reparseNotInSpi];
      if (spiSkipped > 0) {
        log.info(`[SPI] ${spiSkipped} URLs sin cambios (lastmod ≤ scrapedAt). A procesar: ${urls.length}${reparseNotInSpi.length > 0 ? ` (+${reparseNotInSpi.length} reparse)` : ''}`);
      }
    } else {
      const freshUrls = this.cache.filterNew(activityUrls);
      // Las URLs de reparse pasan aunque ya estén en caché
      const reparseNotInFresh = [...reparseUrls].filter((u) => !freshUrls.includes(u));
      afterCache = [...freshUrls, ...reparseNotInFresh];
    }

    // Normalización para comparación robusta — evita falsos "nuevos" por:
    //   http vs https, trailing slash, mayúsculas en dominio
    // Query params SE CONSERVAN: pueden ser identidad del recurso (ej: ?id=123)
    const normalizeForDiff = (url: string): string =>
      url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

    // 2ª capa: diff contra activities en BD (fuente de verdad absoluta)
    // Detecta URLs que pasaron el cache pero ya tienen actividad guardada
    // (ej: cache vacío por deploy, actividad existe en BD)
    let newUrls = afterCache;
    if (afterCache.length > 0 && this.storage) {
      try {
        const existingInDb = await prisma.activity.findMany({
          where: { sourceUrl: { in: afterCache } },
          select: { sourceUrl: true },
        });
        // Normalizar ambos lados para comparación resiliente
        const existingNorm = new Set(
          existingInDb.map((a) => normalizeForDiff(a.sourceUrl ?? '')).filter(Boolean),
        );
        const beforeDbFilter = afterCache.length;
        newUrls = afterCache.filter((url) =>
          // Siempre incluir URLs marcadas para re-proceso (pueden mejorar calidad con Gemini)
          reparseUrls.has(url) ||
          !existingNorm.has(normalizeForDiff(url))
        );
        const dbSkipped = beforeDbFilter - newUrls.length;
        if (dbSkipped > 0) {
          log.info(`⏭️  DB diff: ${dbSkipped} URLs ya tienen actividad en BD (cache miss cubierto)`);
          // Rehidratar caché solo para URLs que no tengan ya una entrada con datos
          // (no sobreescribir parserSource/needsReparse con add vacío)
          for (const url of afterCache.filter((u) => existingNorm.has(normalizeForDiff(u)) && !reparseUrls.has(u))) {
            if (!this.cache.has(url)) this.cache.add(url, '');
          }
        }
      } catch (err: unknown) {
        // Non-fatal — si falla el diff, continúa con el resultado del cache
        log.warn('[pipeline] DB diff fallido, usando solo cache', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const skipped = activityUrls.length - newUrls.length;
    if (skipped > 0) {
      log.info(`⏭️  Saltando ${skipped} URLs ya conocidas (cache + BD). Nuevas: ${newUrls.length}`);
    }

    if (newUrls.length === 0) {
      log.info('✅ Todo al día — no hay actividades nuevas.');
      if (this.logger && logId && sourceId) {
        await this.logger.completeRun(logId, { itemsFound: activityUrls.length, itemsNew: 0, itemsUpdated: 0, itemsDuplicated: skipped });
        await this.logger.updateSourceStatus(sourceId, 'SUCCESS' as any, activityUrls.length);
      }
      return {
        sourceUrl: listingUrl,
        discoveredLinks: allLinks.length,
        filteredLinks: activityUrls.length,
        results: [],
      };
    }

    // Fase 3: Scrapear solo actividades NUEVAS secuencialmente (concurrencia=1 respeta 5 RPM Gemini)
    // Las URLs marcadas para re-proceso (needsReparse) se incluyen aquí y hacen skip de Date Preflight:
    // ya sabemos que son actividades reales — el run anterior las cacheó pero no las guardó por cuota.
    log.info(`Fase 3: Scrapeando ${newUrls.length} actividades nuevas (concurrencia: ${concurrency})...`);
    const results: BatchPipelineResult['results'] = [];
    let preflightCallsPhase3  = 0;
    let preflightSkippedPhase3 = 0;

    if (concurrency <= 1) {
      // Procesamiento secuencial — sin bursts, respeta rate limit de Gemini
      for (let i = 0; i < newUrls.length; i++) {
        const actUrl = newUrls[i];
        // Skip preflight si la URL ya está en caché como reparse (sabemos que es actividad válida)
        const skipPreflight = reparseUrls.has(actUrl);
        if (skipPreflight) preflightSkippedPhase3++;
        else               preflightCallsPhase3++;
        try {
          const data = await this.runPipeline(actUrl, host, { skipPreflight });
          // Pasa parserSource + confidenceScore al caché para marcar needsReparse si aplica
          this.cache.add(actUrl, data.title, lastmodIndex.get(actUrl), {
            parserSource:    data.parserSource,
            confidenceScore: data.confidenceScore,
          });
          // ── Rechazo Jerárquico (LLM -> Gate) ──────────────
          if (data.isActivity !== true) {
            log.warn(`[discard:llm] Rechazado por LLM fail-safe: "${data.title}"`, { url: actUrl });
          } else {
          // ── Activity Gate: valida contenido antes de persistir ──────────────
          const gate = evaluateActivityGate(data, actUrl);
          if (!gate.pass) {
            log.warn(`[discard:gate] Rechazado por heurística: "${data.title}" | reason=${gate.reason}`, { url: actUrl, score: gate.score });
          } else {
          // ── Streaming save: threshold diferenciado por origen del parser ──
          // fallback Cheerio (0.5) es más estricto que Gemini (0.3) para reducir ruido
          const streamThreshold = data.parserSource === 'fallback' ? 0.5 : 0.3;
          if (this.storage && data.confidenceScore >= streamThreshold) {
            try {
              await this.storage.saveActivity(data, actUrl);
              log.info(`[STREAMING] ✅ Guardada: "${data.title}" (${data.parserSource ?? 'gemini'}, score=${data.confidenceScore}, gate=${gate.score.toFixed(2)})`);
            } catch (err: any) {
              log.warn(`[STREAMING] Error (non-fatal, Fase 4 reintentará): ${err?.message}`);
            }
          }
          } // end gate.pass check
          } // end isActivity check
          results.push({ url: actUrl, data });
        } catch (error: any) {
          log.error(`Error en ${actUrl}: ${error.message}`);
          results.push({ url: actUrl, data: null, error: error.message });
        }
        log.info(`Progreso: ${i + 1}/${newUrls.length} procesadas`);
      }
    } else {
      // Procesamiento en paralelo controlado (solo si concurrency > 1 explícito)
      for (let i = 0; i < newUrls.length; i += concurrency) {
        const batch = newUrls.slice(i, i + concurrency);
        const batchPromises = batch.map(async (actUrl) => {
          const skipPreflight = reparseUrls.has(actUrl);
          try {
            const data = await this.runPipeline(actUrl, host, { skipPreflight });
            this.cache.add(actUrl, data.title, lastmodIndex.get(actUrl), {
              parserSource:    data.parserSource,
              confidenceScore: data.confidenceScore,
            });
            // ── Activity Gate — paralelo ──────────────────────────────────────
            if (data.isActivity !== true) {
              log.warn(`[discard:llm] Rechazado por LLM fail-safe: "${data.title}"`, { url: actUrl });
            } else {
            const gate = evaluateActivityGate(data, actUrl);
            if (!gate.pass) {
              log.warn(`[discard:gate] Rechazado por heurística: "${data.title}" | reason=${gate.reason}`, { url: actUrl });
            } else {
            // ── Streaming save — threshold diferenciado ──
            const streamThreshold = data.parserSource === 'fallback' ? 0.5 : 0.3;
            if (this.storage && data.confidenceScore >= streamThreshold) {
              try {
                await this.storage.saveActivity(data, actUrl);
                log.info(`[STREAMING] ✅ Guardada: "${data.title}" (${data.parserSource ?? 'gemini'}, score=${data.confidenceScore}, gate=${gate.score.toFixed(2)})`);
              } catch (err: any) {
                log.warn(`[STREAMING] Error (non-fatal): ${err?.message}`);
              }
            } // end storage check
            } // end gate else
            } // end isActivity else
            return { url: actUrl, data };
          } catch (error: any) {
            log.error(`Error en ${actUrl}: ${error.message}`);
            return { url: actUrl, data: null, error: error.message };
          }
        });
        // Contabilizar preflight calls/skips en batch (fuera del async interno para evitar race condition)
        for (const u of batch) {
          if (reparseUrls.has(u)) preflightSkippedPhase3++;
          else                    preflightCallsPhase3++;
        }
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        const processed = Math.min(i + concurrency, newUrls.length);
        log.info(`Progreso: ${processed}/${newUrls.length} procesadas`);
      }
    }

    // Persistir cache al disco
    this.cache.save();
    await this.cache.saveToDb();
    log.info(`Cache actualizado: ${this.cache.size} URLs totales`);

    const successful = results.filter((r) => r.data !== null).length;
    const errors = results.filter((r) => r.data === null);
    log.info(`========== FIN BATCH PIPELINE ==========`);
    log.info(`Exitosas: ${successful}/${results.length} (${skipped} omitidas por cache)`);

    // ── Summary preflight — visibilidad de cuota consumida ────────────────────
    const ps = getPreflightStats();
    if (ps.total > 0) {
      const pct = (n: number) => ps.total > 0 ? `${Math.round(n / ps.total * 100)}%` : '0%';
      log.info('[DATE-PREFLIGHT:SUMMARY]', {
        total:             ps.total,
        sent_to_gemini:    ps.sent_to_gemini,
        skipped_datetime:  ps.skipped_datetime,
        skipped_text_date: ps.skipped_text_date,
        skipped_past_year: ps.skipped_past_year,
        skipped_keyword:   ps.skipped_keyword,
        gemini_rate:       pct(ps.sent_to_gemini),
        skip_rate:         pct(ps.total - ps.sent_to_gemini),
      });
    }

    // ── Summary parser — visibilidad de resiliencia Gemini ────────────────────
    const pm = getParserMetrics();
    log.info('[PARSER:SUMMARY]', {
      gemini_ok:              pm.geminiOk,
      fallback_analyze_count: pm.fallbackUsed,
      gemini_errors:          pm.geminiErrors,
      discover_ok:            pm.discoverOk,
      fallback_discover_count: pm.discoverFallback,
      fallback_rate: (pm.geminiOk + pm.fallbackUsed) > 0
        ? `${Math.round(pm.fallbackUsed / (pm.geminiOk + pm.fallbackUsed) * 100)}%`
        : '0%',
    });

    const batchResult: BatchPipelineResult = {
      sourceUrl: listingUrl,
      sourceId: sourceId ?? null,
      discoveredLinks: allLinks.length,
      filteredLinks: activityUrls.length,
      parserMetrics: {
        geminiOk:      pm.geminiOk,
        fallbackCount: pm.fallbackUsed,
      },
      results,
    };

    // Fase 4: Guardar en BD si está habilitado
    let savedCount = 0;
    if (this.storage) {
      log.info(`Fase 4: Guardando en base de datos...`);
      const saveResult = await this.storage.saveBatchResults(batchResult);
      savedCount = saveResult.saved;
      batchResult.savedCount = savedCount;
      log.info(`BD: ${saveResult.saved} guardadas, ${saveResult.skipped} omitidas, ${saveResult.errors.length} errores`);
    }

    // Logging: completar el log
    if (this.logger && logId && sourceId) {
      try {
        const status = errors.length > 0 && successful > 0 ? 'PARTIAL' : errors.length > 0 ? 'FAILED' : 'SUCCESS';
        await this.logger.completeRun(logId, {
          itemsFound: activityUrls.length,
          itemsNew: savedCount,
          itemsUpdated: 0,
          itemsDuplicated: skipped,
          errorMessage: errors.length > 0 ? `${errors.length} URLs fallaron` : undefined,
          metadata: { discoveredLinks: allLinks.length, processed: results.length, cached: skipped },
        });
        await this.logger.updateSourceStatus(sourceId, status as any, activityUrls.length);

        // -- Skew Guardrail (Post-Ingesta) --
        // Ejecución lazy para no bloquear la finalización
        import('./quality/category-skew').then(module => {
          module.runCategorySkewGuardrail().catch(e => log.error('Guardrail err', e));
        }).catch(err => log.error('Failed to run category skew guardrail', err));

      } catch (err: any) {
        log.warn(`Logger complete error (non-fatal): ${err.message}`);
      }
    }

    // ── FUNNEL:SUMMARY — embudo completo por fuente ───────────────────────────
    const reparseCount = [...reparseUrls].filter((u) => newUrls.includes(u)).length;
    log.info('[FUNNEL:SUMMARY]', {
      discovered:               discoveredCount,
      afterHeuristics:          afterHeuristicsCount,
      afterGemini:              activityUrls.length,
      afterCache:               afterCache.length,
      reparse:                  reparseCount,
      fetched:                  newUrls.length,
      parsed:                   results.filter((r) => r.data !== null).length,
      saved:                    savedCount,
      preflightCalls:           preflightCallsPhase3,
      skippedPreflightFromCache: preflightSkippedPhase3,
    });

    return batchResult;
  }

  /**
   * Recovery Pipeline (PARSE_ONLY mode).
   * Omite la fase completa de discovery y preflight de URLs y se dirige directamente a intentar reparar 
   * el scraping de URLs problemáticas registradas con cuota Gemini usando un fetch determinista y parseo profundo.
   */
  async runReparsePipeline(urls: string[], listingUrl: string): Promise<BatchPipelineResult> {
    const host = new URL(listingUrl).hostname.replace('www.', '');
    log.info(`\n[REPARSE] ========== INICIO REPARSE PIPELINE ==========`);
    log.info(`Dominio: ${host} | URLs a intentar recuperar: ${urls.length}`);

    // Sincronizar cache solo para reparse
    this.cache.setSource(host);
    await this.cache.syncFromDb(host);

    const results: BatchPipelineResult['results'] = [];
    let savedCount = 0;

    for (let i = 0; i < urls.length; i++) {
        const actUrl = urls[i];
        try {
          const data = await this.runPipeline(actUrl, host, { skipPreflight: true });
          
          this.cache.add(actUrl, data.title, undefined, {
            parserSource:    data.parserSource,
            confidenceScore: data.confidenceScore,
          });

          const streamThreshold = data.parserSource === 'fallback' ? 0.5 : 0.3;
          if (this.storage && data.confidenceScore >= streamThreshold) {
            try {
              await this.storage.saveActivity(data, actUrl);
              log.info(`[REPARSE-STREAMING] ✅ Recuperada: "${data.title}" (score=${data.confidenceScore})`);
              savedCount++;
            } catch (err: any) {
              log.warn(`[REPARSE-STREAMING] Error (non-fatal): ${err?.message}`);
            }
          }
          results.push({ url: actUrl, data });
        } catch (error: any) {
          log.error(`[REPARSE] Error en ${actUrl}: ${error.message}`);
          results.push({ url: actUrl, data: null, error: error.message });
        }
        log.info(`Reparse Progreso: ${i + 1}/${urls.length}`);
    }

    this.cache.save();
    await this.cache.saveToDb();

    log.info(`========== FIN REPARSE PIPELINE ==========`);
    log.info(`Recuperadas y Guardadas: ${savedCount}/${urls.length}`);

    return {
      sourceUrl: listingUrl,
      sourceId: host,
      discoveredLinks: urls.length,
      filteredLinks: urls.length,
      savedCount,
      results
    };
  }

  /**
   * Scrape an Instagram profile: extract posts, analyze each with Gemini,
   * optionally save to DB. Posts are processed sequentially to avoid bans.
   */
  async runInstagramPipeline(
    profileUrl: string,
    options: InstagramExtractOptions | number = {},
  ): Promise<InstagramPipelineResult> {
    const opts: InstagramExtractOptions = typeof options === 'number' ? { maxPosts: options } : options;
    const maxPosts = Math.min(Math.max(opts.maxPosts ?? 6, 1), 12);
    const contentMode = opts.contentMode ?? 'text';
    
    const host = new URL(profileUrl).hostname.replace('www.', ''); // 'instagram.com'
    const { skip, reason } = await shouldSkipSource(host);
    if (skip) {
      log.warn(`Abortando Instagram Pipeline. Fuente ${host} está penalizada con status CRITICAL o por auto-recovery. Motivo: ${reason}`);
      return { profileUrl, username: profileUrl, postsExtracted: 0, results: [] };
    }

    log.info(`\n[IG-PIPELINE] ========== INICIO INSTAGRAM PIPELINE ==========`);
    log.info(`Perfil: ${profileUrl}`);
    log.info(`Max posts: ${maxPosts} | Content mode: ${contentMode}`);
    log.info(`Cache: ${this.cache.size} URLs ya scrapeadas`);

    // Logging: obtener o crear fuente y empezar log
    let logId: string | null = null;
    let sourceId: string | null = null;
    if (this.logger) {
      try {
        const username = profileUrl.replace(/\/$/, '').split('/').pop() ?? 'unknown';
        const cityId = await this.getCityId(this.cityName);
        const verticalId = await this.getVerticalId(this.verticalSlug);
        if (!cityId || !verticalId) {
          log.warn('Logger deshabilitado: cityId o verticalId no encontrados en BD.');
        } else {
        sourceId = await this.logger.getOrCreateSource({
          name: `@${username}`,
          url: profileUrl,
          platform: 'INSTAGRAM',
          scraperType: 'playwright-instagram',
          cityId,
          verticalId,
        });
        logId = await this.logger.startRun(sourceId);
        log.info(`Logger: sourceId=${sourceId}, logId=${logId}`);
        }
      } catch (err: any) {
        log.warn(`Logger init error (non-fatal): ${err.message}`);
      }
    }

    // Lazy-init Playwright extractor
    if (!this.playwrightExtractor) {
      this.playwrightExtractor = new PlaywrightExtractor();
    }

    // Sincronizar cache desde BD antes de filtrar posts ya vistos
    const username = profileUrl.replace(/\/$/, '').split('/').pop() ?? 'unknown';
    await this.cache.syncFromDb(`@${username}`);

    // Phase 1: Extract profile and posts
    log.info(`Fase 1: Extrayendo perfil y posts con Playwright...`);
    const profile = await this.playwrightExtractor.extractProfile(profileUrl, { maxPosts, contentMode });
    log.info(`Perfil: @${profile.username} | Bio: ${profile.bio.substring(0, 80)}...`);
    log.info(`Posts extraidos: ${profile.posts.length}`);

    // Phase 2: Filter already-cached posts
    const newPosts = profile.posts.filter((p) => !this.cache.has(p.url));
    const skipped = profile.posts.length - newPosts.length;
    if (skipped > 0) {
      log.info(`⏭️  Saltando ${skipped} posts ya procesados. Nuevos: ${newPosts.length}`);
    }

    if (newPosts.length === 0) {
      log.info('✅ Todo al dia — no hay posts nuevos.');
      if (this.logger && logId && sourceId) {
        await this.logger.completeRun(logId, { itemsFound: profile.posts.length, itemsNew: 0, itemsUpdated: 0, itemsDuplicated: skipped });
        await this.logger.updateSourceStatus(sourceId, 'SUCCESS' as any, profile.posts.length);
      }
      return {
        profileUrl,
        username: profile.username,
        postsExtracted: profile.posts.length,
        results: [],
      };
    }

    // Phase 3: Analyze each post with Gemini (sequential to avoid rate limits)
    log.info(`Fase 2: Analizando ${newPosts.length} posts con Gemini...`);
    const results: InstagramPipelineResult['results'] = [];
    let preflightSkipped = 0;

    for (let i = 0; i < newPosts.length; i++) {
      const post = newPosts[i];

      // Date Preflight sobre el caption — evita llamadas a Gemini para posts claramente pasados
      const preflight = evaluatePreflight(post.caption ?? '');
      if (preflight.skip) {
        log.info(`⏭️  Post ${i + 1}/${newPosts.length} saltado por Date Preflight (${preflight.reason}): ${post.url}`);
        this.cache.add(post.url, '[preflight-skip]');
        preflightSkipped++;
        continue;
      }

      try {
        log.info(`Analizando post ${i + 1}/${newPosts.length}: ${post.url}`);
        const data = await this.analyzer.analyzeInstagramPost(post, profile.bio);

        // Cache the post regardless of confidence
        this.cache.add(post.url, data.title);
        results.push({ postUrl: post.url, data });

        log.info(`→ "${data.title}" (confianza: ${data.confidenceScore})`);
      } catch (error: any) {
        if (error.message?.includes('QUOTA_EXHAUSTED')) {
          log.warn(`Todas las keys agotadas — deteniendo loop de ${newPosts.length - i - 1} posts restantes.`);
          break; // no contar como failed — cuota no es un fallo de parsing
        }
        log.error(`Error analizando ${post.url}: ${error.message}`);
        results.push({ postUrl: post.url, data: null, error: error.message });
      }
    }

    if (preflightSkipped > 0) {
      log.info(`[IG-PREFLIGHT] ${preflightSkipped}/${newPosts.length} posts saltados por Date Preflight (cuota ahorrada).`);
    }

    // Persist cache
    this.cache.save();
    await this.cache.saveToDb();
    log.info(`Cache actualizado: ${this.cache.size} URLs totales`);

    // Phase 4: Save to DB if enabled
    let savedCount = 0;
    if (this.storage) {
      log.info(`Fase 3: Guardando en base de datos...`);
      let dbSkipped = 0;
      for (const r of results) {
        if (!r.data || r.data.confidenceScore < 0.3) {
          dbSkipped++;
          continue;
        }
        const activityId = await this.storage.saveActivity(
          r.data,
          r.postUrl,
          'kids',
          { platform: 'INSTAGRAM', instagramUsername: profile.username },
        );
        if (activityId) savedCount++;
      }
      log.info(`BD: ${savedCount} guardadas, ${dbSkipped} omitidas (baja confianza o sin datos)`);
    }

    const successful = results.filter((r) => r.data && r.data.confidenceScore >= 0.3).length;
    const errorCount = results.filter((r) => r.data === null).length;
    log.info(`========== FIN INSTAGRAM PIPELINE ==========`);
    log.info(`Actividades encontradas: ${successful}/${results.length}`);

    // Logging: completar el log
    if (this.logger && logId && sourceId) {
      try {
        const status = errorCount > 0 && successful > 0 ? 'PARTIAL' : errorCount > 0 ? 'FAILED' : 'SUCCESS';
        await this.logger.completeRun(logId, {
          itemsFound: newPosts.length,
          itemsNew: savedCount,
          itemsUpdated: 0,
          itemsDuplicated: skipped,
          errorMessage: errorCount > 0 ? `${errorCount} posts fallaron` : undefined,
          metadata: { postsExtracted: profile.posts.length, processed: results.length, cached: skipped },
        });
        await this.logger.updateSourceStatus(sourceId, status as any, newPosts.length);
      } catch (err: any) {
        log.warn(`Logger complete error (non-fatal): ${err.message}`);
      }
    }

    return {
      profileUrl,
      username: profile.username,
      postsExtracted: profile.posts.length,
      savedCount,
      results,
    };
  }

  /**
   * Helper: obtener cityId por nombre (cached).
   */
  private cityCache: Record<string, string | null> = {};
  private async getCityId(cityName: string): Promise<string | null> {
    if (cityName in this.cityCache) return this.cityCache[cityName];

    const { PrismaPg } = await import('@prisma/adapter-pg');
    const { PrismaClient } = await import('../../generated/prisma/client');
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    const p = new PrismaClient({ adapter });

    const city = await p.city.findFirst({ where: { name: cityName } });
    await p.$disconnect();
    const id = city?.id ?? null;
    this.cityCache[cityName] = id;
    if (!id) log.warn(`Ciudad no encontrada: "${cityName}". Logger deshabilitado para esta fuente.`);
    return id;
  }

  /**
   * Helper: obtener verticalId por slug (cached).
   */
  private verticalCache: Record<string, string | null> = {};
  private async getVerticalId(slug: string): Promise<string | null> {
    if (slug in this.verticalCache) return this.verticalCache[slug];

    const { PrismaPg } = await import('@prisma/adapter-pg');
    const { PrismaClient } = await import('../../generated/prisma/client');
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    const p = new PrismaClient({ adapter });

    const vertical = await p.vertical.findUnique({ where: { slug } });
    await p.$disconnect();
    const id = vertical?.id ?? null;
    this.verticalCache[slug] = id;
    if (!id) log.warn(`Vertical no encontrada: "${slug}". Logger deshabilitado para esta fuente.`);
    return id;
  }

  async disconnect(): Promise<void> {
    if (this.playwrightExtractor) {
      await this.playwrightExtractor.close();
    }
    if (this.storage) {
      await this.storage.disconnect();
    }
  }
}
