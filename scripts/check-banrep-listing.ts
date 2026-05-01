/**
 * check-banrep-listing.ts
 * Diagnóstico rápido: extrae los links de eventos del listing de Banrep Bogotá
 * usando Playwright y compara con el caché para saber cuántos son nuevos.
 * NO llama a Gemini, NO guarda nada en BD.
 *
 * Uso: npx tsx scripts/check-banrep-listing.ts
 */
import 'dotenv/config';
import { chromium } from 'playwright';
import { ScrapingCache } from '../src/modules/scraping/cache';

const LISTING_URL = 'https://www.banrepcultural.org/actividades/bogota';
const DOMAIN = 'banrepcultural.org';

async function main() {
  console.log('🔍 Verificando listing de Banrep Bogotá...\n');

  // Cargar caché desde BD
  const cache = new ScrapingCache(DOMAIN);
  await cache.syncFromDb(DOMAIN);
  const cachedCount = cache.size;
  console.log(`📦 URLs en caché (BD): ${cachedCount}\n`);

  // Playwright: navegar al listing
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log(`🌐 Navegando a: ${LISTING_URL}`);
  await page.goto(LISTING_URL, { waitUntil: 'networkidle', timeout: 30_000 });

  // Esperar que cargue el contenido dinámico
  await page.waitForTimeout(3000);

  // Extraer todos los links que parezcan eventos
  const links = await page.$$eval('a[href]', (anchors) =>
    anchors
      .map((a) => ({
        href: (a as HTMLAnchorElement).href,
        text: (a as HTMLAnchorElement).textContent?.trim().slice(0, 80) ?? '',
      }))
      .filter(
        ({ href }) =>
          href.includes('banrepcultural.org') &&
          !href.includes('/actividades') &&
          href.length > 40
      )
  );

  // Deduplicar
  const unique = [...new Map(links.map((l) => [l.href, l])).values()];

  console.log(`\n📋 Links encontrados en el listing: ${unique.length}\n`);

  let nuevos = 0;
  let cacheados = 0;

  for (const { href, text } of unique) {
    const inCache = cache.has(href);
    if (inCache) {
      cacheados++;
      console.log(`  ✅ CACHEADO  | ${href.replace('https://www.banrepcultural.org', '')}`);
    } else {
      nuevos++;
      console.log(`  🆕 NUEVO     | ${href.replace('https://www.banrepcultural.org', '')} — "${text}"`);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📊 RESUMEN:`);
  console.log(`   Total en listing : ${unique.length}`);
  console.log(`   Ya en caché      : ${cacheados}`);
  console.log(`   NUEVOS (sin caché): ${nuevos}`);
  console.log(`\n${nuevos > 0 ? '⚠️  HAY EVENTOS NUEVOS — vale la pena correr el ingest con más URLs' : '✅ Todo cacheado — Banrep no tiene eventos nuevos hoy'}`);

  await browser.close();
}

main().catch(console.error);
