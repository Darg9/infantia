import { readFileSync, writeFileSync, existsSync } from 'fs';

type CacheEntry = {
  url: string;
  title: string;
  scrapedAt: string;
};

type CacheData = {
  entries: Record<string, CacheEntry>;
};

const CACHE_PATH = 'data/scraping-cache.json';

export class ScrapingCache {
  private data: CacheData;

  constructor() {
    this.data = this.load();
  }

  private load(): CacheData {
    if (!existsSync(CACHE_PATH)) {
      return { entries: {} };
    }
    try {
      return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
    } catch {
      return { entries: {} };
    }
  }

  save(): void {
    writeFileSync(CACHE_PATH, JSON.stringify(this.data, null, 2));
  }

  has(url: string): boolean {
    return url in this.data.entries;
  }

  add(url: string, title: string): void {
    this.data.entries[url] = {
      url,
      title,
      scrapedAt: new Date().toISOString(),
    };
  }

  filterNew(urls: string[]): string[] {
    return urls.filter((url) => !this.has(url));
  }

  get size(): number {
    return Object.keys(this.data.entries).length;
  }
}
