// ingest-sources.ts
// Ingesta secuencial de múltiples fuentes con pausa entre cada una.
// Uso: npx tsx scripts/ingest-sources.ts
// Opciones:
//   --dry-run      Descubre links pero NO guarda en BD
//   --max-pages=N  Páginas máximas por fuente (default: 10)

import 'dotenv/config';
import { ScrapingPipeline } from '../src/modules/scraping/pipeline';

interface Source {
  name: string;
  url: string;
  sitemapPatterns?: string[];
}

const SOURCES: Source[] = [
  { name: 'Cinemateca de Bogotá',   url: 'https://cinematecadebogota.gov.co/agenda/11' },
  { name: 'Planetario de Bogotá',   url: 'https://planetariodebogota.gov.co/programate' },
  { name: 'Jardín Botánico (JBB)',  url: 'https://jbb.gov.co/eventos/agenda-cultural-academica/' },
  { name: 'Maloka',                 url: 'https://maloka.org/programacion/' },
  {
    name: 'Banco de la República',
    url: 'https://www.banrepcultural.org/sitemap.xml',
    // Solo actividades y eventos en Bogotá
    sitemapPatterns: ['/bogota/actividad/', '/exposiciones/', '/multimedia/concierto', '/multimedia/taller', '/multimedia/conferencia'],
  },
];

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const maxPagesArg = args.find((a) => a.startsWith('--max-pages='));
  const maxPages = maxPagesArg ? parseInt(maxPagesArg.split('=')[1], 10) : 10;

  console.log(`\n🚀 INGESTA SECUENCIAL — ${SOURCES.length} fuentes`);
  console.log(`   Modo: ${dryRun ? 'DRY RUN (sin guardar)' : 'GUARDAR EN BD'}`);
  console.log(`   Páginas máx por fuente: ${maxPages}\n`);

  const summary: { name: string; saved: number; failed: number; skipped: number }[] = [];

  for (const source of SOURCES) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`▶ ${source.name}`);
    console.log(`  ${source.url}`);
    console.log('='.repeat(60));

    const pipeline = new ScrapingPipeline({ saveToDb: !dryRun });
    try {
      const result = await pipeline.runBatchPipeline(source.url, 3, maxPages, source.sitemapPatterns);
      const saved = result.results.filter((r) => r.data).length;
      const failed = result.results.filter((r) => !r.data).length;
      const skipped = result.discoveredLinks - result.filteredLinks;
      summary.push({ name: source.name, saved, failed, skipped });
      console.log(`\n✅ ${source.name}: ${saved} guardadas, ${failed} fallidas, ${skipped} omitidas`);
    } catch (err: any) {
      console.error(`\n❌ Error fatal en ${source.name}: ${err.message}`);
      summary.push({ name: source.name, saved: 0, failed: 1, skipped: 0 });
    } finally {
      await pipeline.disconnect();
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 RESUMEN FINAL');
  console.log('='.repeat(60));
  for (const s of summary) {
    console.log(`  ${s.name.padEnd(30)} ✅ ${s.saved} guardadas  ❌ ${s.failed} fallidas`);
  }
  const totalSaved = summary.reduce((acc, s) => acc + s.saved, 0);
  console.log(`\n  TOTAL NUEVAS: ${totalSaved} actividades\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
