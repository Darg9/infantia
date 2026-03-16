import { ActivityNLPResult, BatchPipelineResult } from './types';
import { CheerioExtractor } from './extractors/cheerio.extractor';
import { GeminiAnalyzer } from './nlp/gemini.analyzer';
import { ScrapingCache } from './cache';
import { ScrapingStorage } from './storage';

export class ScrapingPipeline {
  private extractor: CheerioExtractor;
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

  async disconnect(): Promise<void> {
    if (this.storage) {
      await this.storage.disconnect();
    }
  }
}
