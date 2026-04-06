import { ActivityNLPResult, BatchPipelineResult, InstagramPipelineResult } from './types';
import { CheerioExtractor } from './extractors/cheerio.extractor';
import { PlaywrightExtractor, InstagramExtractOptions } from './extractors/playwright.extractor';
import { GeminiAnalyzer } from './nlp/gemini.analyzer';
import { ScrapingCache } from './cache';
import { ScrapingStorage } from './storage';
import { ScrapingLogger } from './logger';
import { createLogger } from '../../lib/logger';

const log = createLogger('scraping:pipeline');

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

  async runPipeline(url: string): Promise<ActivityNLPResult> {
    log.info(`1. Iniciando extracción desde: ${url}`);

    let extractionResult = await this.extractor.extract(url);

    // Fallback a Playwright si Cheerio falló o devolvió texto insuficiente (SPA)
    if (extractionResult.status === 'FAILED' || (extractionResult.sourceText ?? '').length < 50) {
      log.warn('Cheerio devolvió texto insuficiente. Intentando con Playwright...');
      if (!this.playwrightExtractor) {
        this.playwrightExtractor = new PlaywrightExtractor();
      }
      const playwrightResult = await this.playwrightExtractor.extractWebText(url);
      if (playwrightResult.status === 'SUCCESS') {
        extractionResult = playwrightResult;
      }
    }

    if (extractionResult.status === 'FAILED' || !extractionResult.sourceText) {
      throw new Error(`[PIPELINE] Falló la extracción inicial: ${extractionResult.error}`);
    }

    const textLength = extractionResult.sourceText.length;
    log.info(`2. Extracción exitosa. Longitud de texto crudo: ${textLength} caracteres`);

    log.info(`3. Enviando a NLP (Gemini) para estructurar datos...`);
    const finalData = await this.analyzer.analyze(extractionResult.sourceText, url);

    log.info(`4. Análisis IA completado con confianza: ${finalData.confidenceScore}`);

    // Enriquecer con og:image extraída por el scraper (si Gemini no proveyó una)
    if (!finalData.imageUrl && extractionResult.ogImage) {
      finalData.imageUrl = extractionResult.ogImage;
      log.info(`4b. og:image adjuntada desde scraper: ${extractionResult.ogImage}`);
    }

    return finalData;
  }

  async runBatchPipeline(listingUrl: string, opts: { maxPages?: number; sitemapPatterns?: string[]; concurrency?: number } = {}): Promise<BatchPipelineResult> {
    const { maxPages = 50, sitemapPatterns = [], concurrency = 1 } = opts;
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
    await this.cache.syncFromDb(new URL(listingUrl).hostname.replace('www.', ''));

    // Fase 1: Extraer links de TODAS las páginas del listado
    log.info(`Fase 1: Extrayendo links (con paginación automática)...`);

    // Detección automática de sitemap XML
    const isSitemap = listingUrl.includes('sitemap') && (listingUrl.endsWith('.xml') || listingUrl.includes('.xml'));
    let allLinks = isSitemap
      ? await this.extractor.extractSitemapLinks(listingUrl, sitemapPatterns)
      : await this.extractor.extractLinksAllPages(listingUrl, maxPages);
    log.info(`Links totales encontrados: ${allLinks.length}`);

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
    log.info(`Fase 2: Filtrando links con IA...`);
    const activityUrls = await this.analyzer.discoverActivityLinks(allLinks, listingUrl);
    log.info(`Links identificados como actividades: ${activityUrls.length}`);

    if (activityUrls.length === 0) {
      log.warn('Gemini no identificó ningún link como actividad.');
      if (this.logger && logId && sourceId) {
        await this.logger.completeRun(logId, { itemsFound: 0, itemsNew: 0, itemsUpdated: 0, itemsDuplicated: 0, metadata: { discoveredLinks: allLinks.length } });
        await this.logger.updateSourceStatus(sourceId, 'SUCCESS' as any, 0);
      }
      return { sourceUrl: listingUrl, discoveredLinks: allLinks.length, filteredLinks: 0, results: [] };
    }

    // Fase 2.5: Filtrar URLs ya scrapeadas (incremental)
    const newUrls = this.cache.filterNew(activityUrls);
    const skipped = activityUrls.length - newUrls.length;
    if (skipped > 0) {
      log.info(`⏭️  Saltando ${skipped} URLs ya scrapeadas. Nuevas: ${newUrls.length}`);
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
    log.info(`Fase 3: Scrapeando ${newUrls.length} actividades nuevas (concurrencia: ${concurrency})...`);
    const results: BatchPipelineResult['results'] = [];

    if (concurrency <= 1) {
      // Procesamiento secuencial — sin bursts, respeta rate limit de Gemini
      for (let i = 0; i < newUrls.length; i++) {
        const actUrl = newUrls[i];
        try {
          const data = await this.runPipeline(actUrl);
          this.cache.add(actUrl, data.title);
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
          try {
            const data = await this.runPipeline(actUrl);
            this.cache.add(actUrl, data.title);
            return { url: actUrl, data };
          } catch (error: any) {
            log.error(`Error en ${actUrl}: ${error.message}`);
            return { url: actUrl, data: null, error: error.message };
          }
        });
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

    const batchResult: BatchPipelineResult = {
      sourceUrl: listingUrl,
      discoveredLinks: allLinks.length,
      filteredLinks: activityUrls.length,
      results,
    };

    // Fase 4: Guardar en BD si está habilitado
    let savedCount = 0;
    if (this.storage) {
      log.info(`Fase 4: Guardando en base de datos...`);
      const saveResult = await this.storage.saveBatchResults(batchResult);
      savedCount = saveResult.saved;
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
      } catch (err: any) {
        log.warn(`Logger complete error (non-fatal): ${err.message}`);
      }
    }

    return batchResult;
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

    for (let i = 0; i < newPosts.length; i++) {
      const post = newPosts[i];
      try {
        log.info(`Analizando post ${i + 1}/${newPosts.length}: ${post.url}`);
        const data = await this.analyzer.analyzeInstagramPost(post, profile.bio);

        // Cache the post regardless of confidence
        this.cache.add(post.url, data.title);
        results.push({ postUrl: post.url, data });

        log.info(`→ "${data.title}" (confianza: ${data.confidenceScore})`);
      } catch (error: any) {
        log.error(`Error analizando ${post.url}: ${error.message}`);
        results.push({ postUrl: post.url, data: null, error: error.message });
      }
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
