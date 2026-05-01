import { getErrorMessage } from '../../lib/error';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { createLogger } from '../../lib/logger';

const log = createLogger('scraping:cache');

type CacheEntry = {
  url: string;
  title: string;
  scrapedAt: string;
  /** Último <lastmod> visto en el sitemap cuando se scrapeó esta URL. */
  lastmod?: string;
  /** Origen del parser que extrajo esta URL. */
  parserSource?: 'gemini' | 'fallback';
  /** Confidence score obtenida en la última extracción. */
  confidenceScore?: number;
  /**
   * true  → se procesó con fallback Cheerio y no se guardó (confidence < 0.5).
   *         Debe re-procesarse con Gemini en el próximo run que tenga cuota.
   * false → ya procesado con Gemini, o guardado correctamente.
   */
  needsReparse?: boolean;
};

type CacheData = {
  entries: Record<string, CacheEntry>;
};

const CACHE_PATH = 'data/scraping-cache.json';

/**
 * ScrapingCache — caché dual: disco (local, rápido) + BD (persistente entre máquinas).
 *
 * Estrategia:
 * - Al iniciar: carga desde disco (sync, instantáneo)
 * - syncFromDb(): carga desde BD y fusiona con disco (call explícito antes de correr)
 * - save(): guarda en disco
 * - saveToDb(): persiste entradas nuevas en BD (call explícito al final)
 */
export class ScrapingCache {
  private data: CacheData;
  private newEntries: Map<string, { title: string; source: string }> = new Map();
  private sourceName: string;

  constructor(sourceName = 'unknown') {
    this.sourceName = sourceName;
    this.data = this.load();
  }

  private load(): CacheData {
    if (!existsSync(CACHE_PATH)) return { entries: {} };
    try {
      return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
    } catch {
      return { entries: {} };
    }
  }

  /** Sincroniza desde BD — llamar antes de procesar para evitar re-scrapear */
  async syncFromDb(source?: string): Promise<void> {
    try {
      const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
      const prisma = new PrismaClient({ adapter });

      const where = source ? { source } : {};
      type ScrapingCacheModel = {
        findMany: (args: { where: Record<string, unknown>; select: Record<string, unknown> }) => Promise<{ url: string; title: string; scrapedAt: Date }[]>;
      };
      const cacheModel = (prisma as unknown as { scrapingCache: ScrapingCacheModel }).scrapingCache;
      const rows = await cacheModel.findMany({ where, select: { url: true, title: true, scrapedAt: true } });
      let added = 0;
      for (const row of rows) {
        if (!(row.url in this.data.entries)) {
          this.data.entries[row.url] = { url: row.url, title: row.title, scrapedAt: row.scrapedAt.toISOString() };
          added++;
        }
      }
      await prisma.$disconnect();
      if (added > 0) log.info(`syncFromDb: ${added} entradas nuevas desde BD (total: ${this.size})`);
    } catch (err: unknown) {
      log.warn(`syncFromDb falló (non-fatal, usando solo disco): ${getErrorMessage(err) ?? String(err)}`);
    }
  }

  /** Persiste entradas nuevas en BD */
  async saveToDb(): Promise<void> {
    if (this.newEntries.size === 0) return;
    try {
      const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
      const prisma = new PrismaClient({ adapter });

      const data = Array.from(this.newEntries.entries()).map(([url, { title, source }]) => ({
        url,
        title: title.slice(0, 499),
        source,
      }));

      // upsert en batch
      for (const entry of data) {
        type ScrapingCacheModel = {
          upsert: (args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
        };
        const cacheModel = (prisma as unknown as { scrapingCache: ScrapingCacheModel }).scrapingCache;
        await cacheModel.upsert({
          where: { url: entry.url },
          create: entry,
          update: { title: entry.title, source: entry.source },
        });
      }

      await prisma.$disconnect();
      log.info(`saveToDb: ${data.length} entradas guardadas en BD`);
      this.newEntries.clear();
    } catch (err: unknown) {
      log.warn(`saveToDb falló (non-fatal): ${getErrorMessage(err) ?? String(err)}`);
    }
  }

  save(): void {
    writeFileSync(CACHE_PATH, JSON.stringify(this.data, null, 2));
  }

  /** Actualiza el nombre de fuente (se llama cuando se conoce la URL del listado). */
  setSource(name: string): void {
    this.sourceName = name;
  }

  has(url: string): boolean {
    return url in this.data.entries;
  }

  /**
   * Registra una URL como procesada.
   * @param meta.parserSource  'gemini' | 'fallback' — quién extrajo el contenido
   * @param meta.confidenceScore — score de la extracción
   * Si parserSource='fallback' y confidenceScore < 0.5, marca needsReparse=true
   * para que el próximo run con Gemini disponible la re-procese.
   */
  add(url: string, title: string, lastmod?: string, meta?: {
    parserSource?: 'gemini' | 'fallback';
    confidenceScore?: number;
  }): void {
    const parserSource   = meta?.parserSource;
    const confidenceScore = meta?.confidenceScore;
    const needsReparse   = parserSource === 'fallback'
      && confidenceScore !== undefined
      && confidenceScore < 0.5;

    this.data.entries[url] = {
      url,
      title,
      scrapedAt: new Date().toISOString(),
      lastmod,
      parserSource,
      confidenceScore,
      needsReparse: needsReparse || false,
    };
    this.newEntries.set(url, { title, source: this.sourceName });
  }

  /** true si la URL fue cacheada con fallback de baja confianza y debe re-procesarse con Gemini. */
  isMarkedForReparse(url: string): boolean {
    return this.data.entries[url]?.needsReparse === true;
  }

  /** Devuelve el subconjunto de `candidates` que están marcados para re-proceso. */
  getReparseUrls(candidates: string[]): string[] {
    return candidates.filter((url) => this.isMarkedForReparse(url));
  }

  /**
   * Obtiene TODAS las URLs guardadas localmente en cache que necesitan reparse para un domino específico.
   * Útil para el Recovery Pipeline del Scheduler Inteligente.
   */
  getReparseUrlsByDomain(domain: string): string[] {
    const urls: string[] = [];
    for (const entry of Object.values(this.data.entries)) {
      if (entry.needsReparse === true && entry.url.includes(domain)) {
        urls.push(entry.url);
      }
    }
    return urls;
  }

  filterNew(urls: string[]): string[] {
    return urls.filter((url) => !this.has(url));
  }

  /**
   * SPI — Sitemap Pre-Index filter.
   *
   * Evita descargar páginas que no han cambiado desde el último scrape.
   * Lógica por URL:
   *   - No en cache            → incluir (primera vez)
   *   - En cache, sin lastmod  → skip (comportamiento conservador)
   *   - En cache, lastmod > scrapedAt → incluir (página actualizada)
   *   - En cache, lastmod ≤ scrapedAt → skip (sin cambios confirmados)
   *
   * @returns urls  — array de URLs a procesar
   * @returns spiSkipped — cuántas se saltaron por lastmod
   */
  filterSPI(entries: Array<{ url: string; lastmod?: string }>): { urls: string[]; spiSkipped: number } {
    const urls: string[] = [];
    let spiSkipped = 0;

    for (const entry of entries) {
      const cached = this.data.entries[entry.url];

      if (!cached) {
        // URL nueva — nunca procesada
        urls.push(entry.url);
        continue;
      }

      if (!entry.lastmod) {
        // Sin información de lastmod → comportamiento conservador: skip
        spiSkipped++;
        continue;
      }

      const lastmodMs  = new Date(entry.lastmod).getTime();
      const scrapedMs  = new Date(cached.scrapedAt).getTime();

      if (isNaN(lastmodMs)) {
        // lastmod inválido → skip conservador
        spiSkipped++;
        continue;
      }

      if (lastmodMs > scrapedMs) {
        // Página modificada después de nuestro último scrape → re-fetch
        urls.push(entry.url);
      } else {
        // Sin cambios
        spiSkipped++;
      }
    }

    return { urls, spiSkipped };
  }

  get size(): number {
    return Object.keys(this.data.entries).length;
  }
}
