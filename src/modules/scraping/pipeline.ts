import { ActivityNLPResult, BatchPipelineResult, InstagramPipelineResult } from './types';
import { CheerioExtractor } from './extractors/cheerio.extractor';
import { PlaywrightExtractor } from './extractors/playwright.extractor';
import { GeminiAnalyzer } from './nlp/gemini.analyzer';
import { ScrapingCache } from './cache';
import { ScrapingStorage } from './storage';

export class ScrapingPipeline {
  private extractor: CheerioExtractor;
  private playwrightExtractor: PlaywrightExtractor | null = null;
  private analyzer: GeminiAnalyzer;
  private cache: ScrapingCache;
  private storage: ScrapingStorage | null;

  constructor(options?: { saveToDb?: boolean }) {
    this.extractor = new CheerioExtractor();
    this.analyzer = new GeminiAnalyzer();
    this.cache = new ScrapingCache();
    this.storage = options?.saveToDb ? new ScrapingStorage() : null;
  }

  async runPipeline(url: string): Promise<ActivityNLPResult> {
    console.log(`[PIPELINE] 1. Iniciando extracción desde: ${url}`);

    const extractionResult = await this.extractor.extract(url);

    if (extractionResult.status === 'FAILED' || !extractionResult.sourceText) {
      throw new Error(`[PIPELINE] Falló la extracción inicial: ${extractionResult.error}`);
    }

    const textLength = extractionResult.sourceText.length;
    console.log(`[PIPELINE] 2. Extracción exitosa. Longitud de texto crudo: ${textLength} caracteres`);

    if (textLength < 50) {
      console.warn('[PIPELINE] Advertencia: Texto extraído demasiado corto. Posiblemente sitio SPA o bloqueado.');
    }

    console.log(`[PIPELINE] 3. Enviando a NLP (Gemini) para estructurar datos...`);
    const finalData = await this.analyzer.analyze(extractionResult.sourceText, url);

    console.log(`[PIPELINE] 4. Análisis IA completado con confianza: ${finalData.confidenceScore}`);

    return finalData;
  }

  async runBatchPipeline(listingUrl: string, concurrency: number = 3, maxPages: number = 50): Promise<BatchPipelineResult> {
    console.log(`\n[BATCH] ========== INICIO BATCH PIPELINE ==========`);
    console.log(`[BATCH] URL de listado: ${listingUrl}`);
    console.log(`[BATCH] Cache: ${this.cache.size} URLs ya scrapeadas`);

    // Fase 1: Extraer links de TODAS las páginas del listado
    console.log(`[BATCH] Fase 1: Extrayendo links (con paginación automática)...`);
    const allLinks = await this.extractor.extractLinksAllPages(listingUrl, maxPages);
    console.log(`[BATCH] Links totales encontrados: ${allLinks.length}`);

    if (allLinks.length === 0) {
      console.warn('[BATCH] No se encontraron links. Posiblemente SPA o página sin enlaces.');
      return { sourceUrl: listingUrl, discoveredLinks: 0, filteredLinks: 0, results: [] };
    }

    // Fase 2: Filtrar con Gemini cuáles son actividades
    console.log(`[BATCH] Fase 2: Filtrando links con IA...`);
    const activityUrls = await this.analyzer.discoverActivityLinks(allLinks, listingUrl);
    console.log(`[BATCH] Links identificados como actividades: ${activityUrls.length}`);

    if (activityUrls.length === 0) {
      console.warn('[BATCH] Gemini no identificó ningún link como actividad.');
      return { sourceUrl: listingUrl, discoveredLinks: allLinks.length, filteredLinks: 0, results: [] };
    }

    // Fase 2.5: Filtrar URLs ya scrapeadas (incremental)
    const newUrls = this.cache.filterNew(activityUrls);
    const skipped = activityUrls.length - newUrls.length;
    if (skipped > 0) {
      console.log(`[BATCH] ⏭️  Saltando ${skipped} URLs ya scrapeadas. Nuevas: ${newUrls.length}`);
    }

    if (newUrls.length === 0) {
      console.log('[BATCH] ✅ Todo al día — no hay actividades nuevas.');
      return {
        sourceUrl: listingUrl,
        discoveredLinks: allLinks.length,
        filteredLinks: activityUrls.length,
        results: [],
      };
    }

    // Fase 3: Scrapear solo actividades NUEVAS con paralelismo controlado
    console.log(`[BATCH] Fase 3: Scrapeando ${newUrls.length} actividades nuevas (concurrencia: ${concurrency})...`);
    const results: BatchPipelineResult['results'] = [];

    for (let i = 0; i < newUrls.length; i += concurrency) {
      const batch = newUrls.slice(i, i + concurrency);
      const batchPromises = batch.map(async (actUrl) => {
        try {
          const data = await this.runPipeline(actUrl);
          // Guardar en cache si fue exitoso
          this.cache.add(actUrl, data.title);
          return { url: actUrl, data };
        } catch (error: any) {
          console.error(`[BATCH] Error en ${actUrl}: ${error.message}`);
          return { url: actUrl, data: null, error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      const processed = Math.min(i + concurrency, newUrls.length);
      console.log(`[BATCH] Progreso: ${processed}/${newUrls.length} procesadas`);
    }

    // Persistir cache al disco
    this.cache.save();
    console.log(`[BATCH] Cache actualizado: ${this.cache.size} URLs totales`);

    const successful = results.filter((r) => r.data !== null).length;
    console.log(`[BATCH] ========== FIN BATCH PIPELINE ==========`);
    console.log(`[BATCH] Exitosas: ${successful}/${results.length} (${skipped} omitidas por cache)`);

    const batchResult: BatchPipelineResult = {
      sourceUrl: listingUrl,
      discoveredLinks: allLinks.length,
      filteredLinks: activityUrls.length,
      results,
    };

    // Fase 4: Guardar en BD si está habilitado
    if (this.storage) {
      console.log(`[BATCH] Fase 4: Guardando en base de datos...`);
      const saveResult = await this.storage.saveBatchResults(batchResult);
      console.log(`[BATCH] BD: ${saveResult.saved} guardadas, ${saveResult.skipped} omitidas, ${saveResult.errors.length} errores`);
    }

    return batchResult;
  }

  /**
   * Scrape an Instagram profile: extract posts, analyze each with Gemini,
   * optionally save to DB. Posts are processed sequentially to avoid bans.
   */
  async runInstagramPipeline(profileUrl: string, maxPosts: number = 12): Promise<InstagramPipelineResult> {
    console.log(`\n[IG-PIPELINE] ========== INICIO INSTAGRAM PIPELINE ==========`);
    console.log(`[IG-PIPELINE] Perfil: ${profileUrl}`);
    console.log(`[IG-PIPELINE] Max posts: ${maxPosts}`);
    console.log(`[IG-PIPELINE] Cache: ${this.cache.size} URLs ya scrapeadas`);

    // Lazy-init Playwright extractor
    if (!this.playwrightExtractor) {
      this.playwrightExtractor = new PlaywrightExtractor();
    }

    // Phase 1: Extract profile and posts
    console.log(`[IG-PIPELINE] Fase 1: Extrayendo perfil y posts con Playwright...`);
    const profile = await this.playwrightExtractor.extractProfile(profileUrl, maxPosts);
    console.log(`[IG-PIPELINE] Perfil: @${profile.username} | Bio: ${profile.bio.substring(0, 80)}...`);
    console.log(`[IG-PIPELINE] Posts extraídos: ${profile.posts.length}`);

    // Phase 2: Filter already-cached posts
    const newPosts = profile.posts.filter((p) => !this.cache.has(p.url));
    const skipped = profile.posts.length - newPosts.length;
    if (skipped > 0) {
      console.log(`[IG-PIPELINE] ⏭️  Saltando ${skipped} posts ya procesados. Nuevos: ${newPosts.length}`);
    }

    if (newPosts.length === 0) {
      console.log('[IG-PIPELINE] ✅ Todo al día — no hay posts nuevos.');
      return {
        profileUrl,
        username: profile.username,
        postsExtracted: profile.posts.length,
        results: [],
      };
    }

    // Phase 3: Analyze each post with Gemini (sequential to avoid rate limits)
    console.log(`[IG-PIPELINE] Fase 2: Analizando ${newPosts.length} posts con Gemini...`);
    const results: InstagramPipelineResult['results'] = [];

    for (let i = 0; i < newPosts.length; i++) {
      const post = newPosts[i];
      try {
        console.log(`[IG-PIPELINE] Analizando post ${i + 1}/${newPosts.length}: ${post.url}`);
        const data = await this.analyzer.analyzeInstagramPost(post, profile.bio);

        // Cache the post regardless of confidence
        this.cache.add(post.url, data.title);
        results.push({ postUrl: post.url, data });

        console.log(`[IG-PIPELINE] → "${data.title}" (confianza: ${data.confidenceScore})`);
      } catch (error: any) {
        console.error(`[IG-PIPELINE] Error analizando ${post.url}: ${error.message}`);
        results.push({ postUrl: post.url, data: null, error: error.message });
      }
    }

    // Persist cache
    this.cache.save();
    console.log(`[IG-PIPELINE] Cache actualizado: ${this.cache.size} URLs totales`);

    // Phase 4: Save to DB if enabled
    if (this.storage) {
      console.log(`[IG-PIPELINE] Fase 3: Guardando en base de datos...`);
      let saved = 0;
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
        if (activityId) saved++;
      }
      console.log(`[IG-PIPELINE] BD: ${saved} guardadas, ${dbSkipped} omitidas (baja confianza o sin datos)`);
    }

    const successful = results.filter((r) => r.data && r.data.confidenceScore >= 0.3).length;
    console.log(`[IG-PIPELINE] ========== FIN INSTAGRAM PIPELINE ==========`);
    console.log(`[IG-PIPELINE] Actividades encontradas: ${successful}/${results.length}`);

    return {
      profileUrl,
      username: profile.username,
      postsExtracted: profile.posts.length,
      results,
    };
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
