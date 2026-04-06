// test-instagram.ts
// Uso: npx tsx scripts/test-instagram.ts "https://www.instagram.com/fcecolombia/"
// Flags: --save-db, --max-posts=N (1-12, default 6), --content-mode=text|image|both (default text)
//        --validate-only  Solo extrae con Playwright (sin Gemini, sin cuota consumida)
//        --count-new      Cuenta posts no vistos vs cache en BD (sin Gemini)

import 'dotenv/config';
import { ScrapingPipeline } from '../src/modules/scraping/pipeline';
import { PlaywrightExtractor } from '../src/modules/scraping/extractors/playwright.extractor';

async function main() {
  const args = process.argv.slice(2);
  const saveToDb = args.includes('--save-db');
  const validateOnly = args.includes('--validate-only');
  const countNew = args.includes('--count-new');
  const maxPostsArg = args.find((a) => a.startsWith('--max-posts='));
  const maxPosts = maxPostsArg ? parseInt(maxPostsArg.split('=')[1], 10) : 6;
  const contentModeArg = args.find((a) => a.startsWith('--content-mode='));
  const contentMode = (contentModeArg?.split('=')[1] ?? 'text') as 'text' | 'image' | 'both';
  const url = args.find((a) => !a.startsWith('--'));

  if (!url || !url.includes('instagram.com')) {
    console.error('Error: Debes proveer una URL de perfil de Instagram.');
    console.log('Uso: npx tsx scripts/test-instagram.ts <PROFILE_URL>');
    console.log('Ejemplo: npx tsx scripts/test-instagram.ts "https://www.instagram.com/fcecolombia/"');
    console.log('Flags: --save-db, --max-posts=N, --validate-only');
    process.exit(1);
  }

  // ── Modo count-new: solo cuenta posts nuevos sin Gemini ───────────────────
  if (countNew) {
    const extractor = new PlaywrightExtractor();
    const { ScrapingCache } = await import('../src/modules/scraping/cache');
    const username = url.replace(/\/$/, '').split('/').pop() ?? 'unknown';
    const cache = new ScrapingCache(`@${username}`);
    const startTime = Date.now();
    try {
      console.log(`\n🔢 COUNT-NEW — @${username} (max ${maxPosts} posts)\n`);
      await cache.syncFromDb(`@${username}`);
      const profile = await extractor.extractProfile(url, { maxPosts, contentMode });
      const newPosts = profile.posts.filter((p) => !cache.has(p.url));
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log('══════════════════════════════════════════════════════');
      console.log(`   @${profile.username}`);
      console.log(`   Posts extraídos: ${profile.posts.length}`);
      console.log(`   Ya procesados:   ${profile.posts.length - newPosts.length}`);
      console.log(`   ✨ NUEVOS:        ${newPosts.length}`);
      if (newPosts.length > 0) {
        console.log('\n   URLs nuevas:');
        for (const p of newPosts) {
          console.log(`     ${p.url}`);
        }
      }
      console.log('══════════════════════════════════════════════════════');
      console.log(`Tiempo: ${elapsed}s — Gemini NO consumido ✅`);
    } finally {
      await extractor.close();
    }
    return;
  }

  // ── Modo validación: solo Playwright, sin Gemini ───────────────────────────
  if (validateOnly) {
    const extractor = new PlaywrightExtractor();
    const startTime = Date.now();
    try {
      console.log(`\n🔍 VALIDACIÓN (sin Gemini) — @${url.replace(/\/$/, '').split('/').pop()}`);
      console.log(`   Max posts: ${maxPosts} | Mode: ${contentMode}\n`);

      const profile = await extractor.extractProfile(url, { maxPosts, contentMode });
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('══════════════════════════════════════════════════════');
      console.log(`✅ Cuenta accesible`);
      console.log(`   @${profile.username}`);
      console.log(`   Bio: ${profile.bio.substring(0, 120)}${profile.bio.length > 120 ? '…' : ''}`);
      console.log(`   Posts extraídos: ${profile.posts.length}/${maxPosts} solicitados\n`);

      if (profile.posts.length === 0) {
        console.log('⚠️  Sin posts — puede estar bloqueada o privada.');
      } else {
        console.log('── Captions extraídas ────────────────────────────────\n');
        for (let i = 0; i < profile.posts.length; i++) {
          const p = profile.posts[i];
          const preview = p.caption
            ? p.caption.substring(0, 120).replace(/\n/g, ' ') + (p.caption.length > 120 ? '…' : '')
            : '(sin caption)';
          console.log(`  ${i + 1}. ${preview}`);
          if (p.imageUrls?.length) console.log(`     📷 ${p.imageUrls.length} imagen(es)`);
          console.log(`     🔗 ${p.url}`);
          console.log();
        }
      }
      console.log('══════════════════════════════════════════════════════');
      console.log(`Tiempo: ${elapsed}s — Gemini NO consumido ✅`);
    } finally {
      await extractor.close();
    }
    return;
  }

  const pipeline = new ScrapingPipeline({ saveToDb });
  if (saveToDb) {
    console.log('DB mode enabled — activities will be saved to PostgreSQL');
  }
  const startTime = Date.now();

  try {
    console.log(`\nInstagram Pipeline — Perfil: ${url} (max ${maxPosts} posts, mode=${contentMode})\n`);
    const result = await pipeline.runInstagramPipeline(url, { maxPosts, contentMode });
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
