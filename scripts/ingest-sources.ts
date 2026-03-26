// ingest-sources.ts
// Ingesta de múltiples fuentes.
// Uso: npx tsx scripts/ingest-sources.ts
// Opciones:
//   --dry-run      Descubre links pero NO guarda en BD
//   --max-pages=N  Páginas máximas por fuente (default: 10)
//   --queue        Encola jobs en Redis/BullMQ y sale (requiere worker corriendo)

import 'dotenv/config';
import { ScrapingPipeline } from '../src/modules/scraping/pipeline';
import { enqueueBatchJob, closeScrapingQueue, closeRedisConnection } from '../src/modules/scraping/queue';

interface Source {
  name: string;
  url: string;
  cityName?: string;
  verticalSlug?: string;
  sitemapPatterns?: string[];
}

const SOURCES: Source[] = [
  { name: 'Cinemateca de Bogotá',   url: 'https://cinematecadebogota.gov.co/agenda/11',             cityName: 'Bogotá', verticalSlug: 'kids' },
  { name: 'Planetario de Bogotá',   url: 'https://planetariodebogota.gov.co/programate',             cityName: 'Bogotá', verticalSlug: 'kids' },
  { name: 'Jardín Botánico (JBB)',  url: 'https://jbb.gov.co/eventos/agenda-cultural-academica/',   cityName: 'Bogotá', verticalSlug: 'kids' },
  { name: 'Maloka',                 url: 'https://maloka.org/programacion/',                         cityName: 'Bogotá', verticalSlug: 'kids' },
  {
    name: 'Banco de la República',
    url: 'https://www.banrepcultural.org/sitemap.xml',
    cityName: 'Bogotá',
    verticalSlug: 'kids',
    // Solo actividades y eventos en Bogotá
    sitemapPatterns: ['/bogota/actividad/', '/exposiciones/', '/multimedia/concierto', '/multimedia/taller', '/multimedia/conferencia'],
  },
];

async function runDirect(dryRun: boolean, maxPages: number) {
  console.log(`\n🚀 INGESTA SECUENCIAL — ${SOURCES.length} fuentes`);
  console.log(`   Modo: ${dryRun ? 'DRY RUN (sin guardar)' : 'GUARDAR EN BD'}`);
  console.log(`   Páginas máx por fuente: ${maxPages}\n`);

  const summary: { name: string; saved: number; failed: number; skipped: number }[] = [];

  for (const source of SOURCES) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`▶ ${source.name}`);
    console.log(`  ${source.url}`);
    console.log('='.repeat(60));

    const pipeline = new ScrapingPipeline({ saveToDb: !dryRun, cityName: source.cityName, verticalSlug: source.verticalSlug });
    try {
      const result = await pipeline.runBatchPipeline(source.url, { maxPages, sitemapPatterns: source.sitemapPatterns });
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

async function runQueue(maxPages: number) {
  console.log(`\n🚀 ENCOLANDO — ${SOURCES.length} fuentes en Redis/BullMQ`);
  console.log(`   Páginas máx por fuente: ${maxPages}`);
  console.log(`   Asegúrate de que el worker esté corriendo: npx tsx scripts/run-worker.ts\n`);

  for (const source of SOURCES) {
    const id = await enqueueBatchJob({
      url: source.url,
      cityName: source.cityName ?? 'Bogotá',
      verticalSlug: source.verticalSlug ?? 'kids',
      maxPages,
      sitemapPatterns: source.sitemapPatterns,
    });
    console.log(`  ✅ ${source.name.padEnd(30)} → job ${id}`);
  }

  console.log(`\n  ${SOURCES.length} jobs encolados. El worker los procesa secuencialmente.\n`);
  await closeScrapingQueue();
  await closeRedisConnection();
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const useQueue = args.includes('--queue');
  const maxPagesArg = args.find((a) => a.startsWith('--max-pages='));
  const maxPages = maxPagesArg ? parseInt(maxPagesArg.split('=')[1], 10) : 10;

  if (useQueue) {
    await runQueue(maxPages);
  } else {
    await runDirect(dryRun, maxPages);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
