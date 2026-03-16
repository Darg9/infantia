// test-scraper.ts
// Uso single:    npx tsx scripts/test-scraper.ts "https://url-de-actividad.com"
// Uso discover:  npx tsx scripts/test-scraper.ts --discover "https://url-de-listado.com"
// Agregar --save-db para guardar en base de datos

import 'dotenv/config';
import { ScrapingPipeline } from '../src/modules/scraping/pipeline';

async function main() {
  const args = process.argv.slice(2);
  const discoverMode = args.includes('--discover');
  const saveToDb = args.includes('--save-db');
  const maxPagesArg = args.find((a) => a.startsWith('--max-pages='));
  const maxPages = maxPagesArg ? parseInt(maxPagesArg.split('=')[1], 10) : 50;
  const url = args.find((a) => !a.startsWith('--'));

  if (!url) {
    console.error('❌ Error: Debes proveer una URL.');
    console.log('Uso single:    npx tsx scripts/test-scraper.ts <URL>');
    console.log('Uso discover:  npx tsx scripts/test-scraper.ts --discover <URL_LISTADO>');
    console.log('Agregar --save-db para guardar en base de datos');
    process.exit(1);
  }

  const pipeline = new ScrapingPipeline({ saveToDb });
  if (saveToDb) {
    console.log('💾 Modo BD activado — las actividades se guardarán en PostgreSQL');
  }
  const startTime = Date.now();

  try {
    if (discoverMode) {
      console.log(`\n🔍 Modo DISCOVER — Descubriendo actividades en: ${url} (máx ${maxPages} páginas)\n`);
      const result = await pipeline.runBatchPipeline(url, 3, maxPages);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('\n✅ ================= RESULTADO BATCH ================= ✅\n');
      console.log(`Links descubiertos: ${result.discoveredLinks}`);
      console.log(`Links filtrados como actividades: ${result.filteredLinks}`);
      console.log(`Exitosos: ${result.results.filter((r) => r.data).length}`);
      console.log(`Fallidos: ${result.results.filter((r) => !r.data).length}`);
      console.log(`\n--- Actividades extraídas ---\n`);

      for (const r of result.results) {
        if (r.data) {
          console.log(`📌 ${r.data.title} (confianza: ${r.data.confidenceScore})`);
          console.log(`   URL: ${r.url}`);
          console.log(`   Categorías: ${r.data.categories.join(', ')}`);
          console.log(`   Edades: ${r.data.minAge ?? '?'} - ${r.data.maxAge ?? '?'}`);
          console.log(`   Precio: ${r.data.price ?? 'N/A'} ${r.data.currency}`);
          console.log('');
        } else {
          console.log(`❌ ${r.url}: ${r.error}`);
          console.log('');
        }
      }

      console.log('======================================================================');
      console.log(`⏱️  Tiempo total: ${elapsed} segundos`);
    } else {
      console.log(`\n🚀 Modo SINGLE — Scrapeando: ${url}\n`);
      const result = await pipeline.runPipeline(url);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('\n✅ ================= RESULTADO FINAL (JSON ESTRUCTURADO) ================= ✅\n');
      console.log(JSON.stringify(result, null, 2));
      console.log('\n======================================================================\n');
      console.log(`⏱️  Tiempo total: ${elapsed} segundos`);
    }
  } catch (error: any) {
    console.error('\n❌ Error catastrófico en el pipeline:', error.message);
  } finally {
    await pipeline.disconnect();
  }
}

main();
