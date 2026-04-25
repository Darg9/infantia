/**
 * inspect-biblored-reparse.ts
 * Diagnóstico del estado de la cola de reparse en data/scraping-cache.json.
 * No usa Prisma — lee el JSON local directamente.
 * Uso: npx tsx scripts/inspect-biblored-reparse.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface CacheEntry {
  url: string;
  title: string;
  scrapedAt?: string;
  needsReparse?: boolean;
  parserSource?: string;
  confidenceScore?: number;
}

interface CacheFile {
  entries: Record<string, CacheEntry>;
}

const CACHE_PATH = path.join(process.cwd(), 'data', 'scraping-cache.json');

function main() {
  if (!fs.existsSync(CACHE_PATH)) {
    console.error('❌ No se encontró data/scraping-cache.json');
    process.exit(1);
  }

  const cache: CacheFile = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
  const entries = Object.values(cache.entries);

  const biblored = entries.filter(e => e.url.includes('biblored'));
  const bibloredReparse = biblored.filter(e => e.needsReparse === true);
  const allReparse = entries.filter(e => e.needsReparse === true);

  // Por dominio
  const reparsePorDominio: Record<string, number> = {};
  for (const e of allReparse) {
    const domain = new URL(e.url).hostname;
    reparsePorDominio[domain] = (reparsePorDominio[domain] ?? 0) + 1;
  }

  const oldest = bibloredReparse
    .sort((a, b) => (a.scrapedAt ?? '').localeCompare(b.scrapedAt ?? ''))
    .slice(0, 5);

  const newest = bibloredReparse
    .sort((a, b) => (b.scrapedAt ?? '').localeCompare(a.scrapedAt ?? ''))
    .slice(0, 3);

  console.log('=== BibloRed Reparse Queue ===');
  console.log('Total en cache (BibloRed):', biblored.length);
  console.log('needsReparse=true (BibloRed):', bibloredReparse.length);
  console.log('\n=== Cola global de reparse ===');
  console.log('Total needsReparse=true (todos los dominios):', allReparse.length);
  console.log('\nDesglose por dominio:');
  for (const [domain, count] of Object.entries(reparsePorDominio).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${domain}: ${count}`);
  }

  if (bibloredReparse.length > 0) {
    console.log('\nMás antiguas BibloRed (¿por qué se atascaron?):');
    oldest.forEach(s => console.log(' ', s.scrapedAt?.substring(0, 10), s.url.substring(0, 80)));
    console.log('\nMás recientes BibloRed:');
    newest.forEach(s => console.log(' ', s.scrapedAt?.substring(0, 10), s.url.substring(0, 80)));
  } else {
    console.log('\n✅ BibloRed: cola de reparse vacía. Scheduler puede procesar normalmente.');
  }
}

main();
