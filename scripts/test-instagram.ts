// test-instagram.ts
// Uso: npx tsx scripts/test-instagram.ts "https://www.instagram.com/fcecolombia/"
// Flags: --save-db, --max-posts=N (default 12)

import 'dotenv/config';
import { ScrapingPipeline } from '../src/modules/scraping/pipeline';

async function main() {
  const args = process.argv.slice(2);
  const saveToDb = args.includes('--save-db');
  const maxPostsArg = args.find((a) => a.startsWith('--max-posts='));
  const maxPosts = maxPostsArg ? parseInt(maxPostsArg.split('=')[1], 10) : 12;
  const url = args.find((a) => !a.startsWith('--'));

  if (!url || !url.includes('instagram.com')) {
    console.error('Error: Debes proveer una URL de perfil de Instagram.');
    console.log('Uso: npx tsx scripts/test-instagram.ts <PROFILE_URL>');
    console.log('Ejemplo: npx tsx scripts/test-instagram.ts "https://www.instagram.com/fcecolombia/"');
    console.log('Flags: --save-db, --max-posts=N');
    process.exit(1);
  }

  const pipeline = new ScrapingPipeline({ saveToDb });
  if (saveToDb) {
    console.log('DB mode enabled — activities will be saved to PostgreSQL');
  }
  const startTime = Date.now();

  try {
    console.log(`\nInstagram Pipeline — Perfil: ${url} (max ${maxPosts} posts)\n`);
    const result = await pipeline.runInstagramPipeline(url, maxPosts);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n================= RESULTADO INSTAGRAM =================\n');
    console.log(`Perfil: @${result.username}`);
    console.log(`Posts extraidos: ${result.postsExtracted}`);
    console.log(`Posts analizados: ${result.results.length}`);

    const activities = result.results.filter((r) => r.data && r.data.confidenceScore >= 0.3);
    const nonActivities = result.results.filter((r) => r.data && r.data.confidenceScore < 0.3);
    const errors = result.results.filter((r) => !r.data);

    console.log(`Actividades encontradas: ${activities.length}`);
    console.log(`No-actividades (baja confianza): ${nonActivities.length}`);
    console.log(`Errores: ${errors.length}`);

    if (activities.length > 0) {
      console.log('\n--- Actividades ---\n');
      for (const r of activities) {
        if (!r.data) continue;
        console.log(`  ${r.data.title} (confianza: ${r.data.confidenceScore})`);
        console.log(`   URL: ${r.postUrl}`);
        console.log(`   Categorias: ${r.data.categories.join(', ')}`);
        console.log(`   Edades: ${r.data.minAge ?? '?'} - ${r.data.maxAge ?? '?'}`);
        console.log(`   Precio: ${r.data.price ?? 'N/A'} ${r.data.currency}`);
        if (r.data.location) {
          console.log(`   Ubicacion: ${r.data.location.address ?? ''} ${r.data.location.city ?? ''}`);
        }
        if (r.data.schedules?.[0]) {
          console.log(`   Fecha: ${r.data.schedules[0].startDate} → ${r.data.schedules[0].endDate ?? '?'}`);
        }
        console.log('');
      }
    }

    if (nonActivities.length > 0) {
      console.log('--- Posts descartados (no son actividades) ---\n');
      for (const r of nonActivities) {
        console.log(`   ${r.postUrl}: "${r.data?.title}" (confianza: ${r.data?.confidenceScore})`);
      }
      console.log('');
    }

    if (errors.length > 0) {
      console.log('--- Errores ---\n');
      for (const r of errors) {
        console.log(`   ${r.postUrl}: ${r.error}`);
      }
      console.log('');
    }

    console.log('======================================================');
    console.log(`Tiempo total: ${elapsed} segundos`);
  } catch (error: any) {
    console.error('\nError en el pipeline de Instagram:', error.message);
  } finally {
    await pipeline.disconnect();
  }
}

main();
