import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createLogger } from '../../lib/logger';

const log = createLogger('scraping:cache');

type CacheEntry = {
  url: string;
  title: string;
  scrapedAt: string;
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
      const { PrismaPg } = await import('@prisma/adapter-pg');
      const { PrismaClient } = await import('../../generated/prisma/client');
      const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
      const prisma = new PrismaClient({ adapter });

      const where = source ? { source } : {};
      const rows = await (prisma as any).scrapingCache.findMany({ where, select: { url: true, title: true, scrapedAt: true } });
      let added = 0;
      for (const row of rows) {
        if (!(row.url in this.data.entries)) {
          this.data.entries[row.url] = { url: row.url, title: row.title, scrapedAt: row.scrapedAt.toISOString() };
          added++;
        }
      }
      await prisma.$disconnect();
      if (added > 0) log.info(`syncFromDb: ${added} entradas nuevas desde BD (total: ${this.size})`);
    } catch (err: any) {
      log.warn(`syncFromDb falló (non-fatal, usando solo disco): ${err?.message ?? String(err)}`);
    }
  }

  /** Persiste entradas nuevas en BD */
  async saveToDb(): Promise<void> {
    if (this.newEntries.size === 0) return;
    try {
      const { PrismaPg } = await import('@prisma/adapter-pg');
      const { PrismaClient } = await import('../../generated/prisma/client');
      const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
      const prisma = new PrismaClient({ adapter });

      const data = Array.from(this.newEntries.entries()).map(([url, { title, source }]) => ({
        url,
        title: title.slice(0, 499),
        source,
      }));

      // upsert en batch
      for (const entry of data) {
        await (prisma as any).scrapingCache.upsert({
          where: { url: entry.url },
          create: entry,
          update: { title: entry.title, source: entry.source },
        });
      }

      await prisma.$disconnect();
      log.info(`saveToDb: ${data.length} entradas guardadas en BD`);
      this.newEntries.clear();
    } catch (err: any) {
      log.warn(`saveToDb falló (non-fatal): ${err?.message ?? String(err)}`);
    }
  }

  save(): void {
    writeFileSync(CACHE_PATH, JSON.stringify(this.data, null, 2));
  }

  has(url: string): boolean {
    return url in this.data.entries;
  }

  add(url: string, title: string): void {
    this.data.entries[url] = { url, title, scrapedAt: new Date().toISOString() };
    this.newEntries.set(url, { title, source: this.sourceName });
  }

  filterNew(urls: string[]): string[] {
    return urls.filter((url) => !this.has(url));
  }

  get size(): number {
    return Object.keys(this.data.entries).length;
  }
}
