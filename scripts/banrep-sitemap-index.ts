// =============================================================================
// banrep-sitemap-index.ts — Índice de URLs Banrep desde sitemap (sin Playwright)
//
// Por qué existe:
//   banrepcultural.org usa Radware ShieldSquare (bot protection enterprise).
//   Todo el contenido está bloqueado EXCEPTO sitemap.xml, que es accesible.
//   Este script extrae el inventario completo de actividades: URLs, ciudades,
//   fechas de actualización — sin consumir cuota Gemini ni Playwright.
//
// Valor:
//   - Inventario completo de contenido Banrep (~4.500 URLs nacionales)
//   - Filtrado por lastmod reciente (detecta contenido activo)
//   - Ciudad extraída del URL (/{ciudad}/actividad/{slug})
//   - Base para futura integración vía Playwright stealth u outreach institucional
//
// Uso:
//   npx tsx scripts/banrep-sitemap-index.ts
//   npx tsx scripts/banrep-sitemap-index.ts --days=30     (solo lastmod reciente)
//   npx tsx scripts/banrep-sitemap-index.ts --city=bogota
//   npx tsx scripts/banrep-sitemap-index.ts --days=90 --city=bogota --save
// =============================================================================

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

// ── Args ──────────────────────────────────────────────────────────────────────

const args       = process.argv.slice(2);
const daysFilter = parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1] ?? '0', 10);
const cityFilter = args.find(a => a.startsWith('--city='))?.split('=')[1]?.toLowerCase();
const saveFlag   = args.includes('--save');
const helpFlag   = args.includes('--help') || args.includes('-h');

if (helpFlag) {
  console.log(`
Uso: npx tsx scripts/banrep-sitemap-index.ts [opciones]

Opciones:
  --days=N     Solo mostrar URLs actualizadas en los últimos N días
  --city=X     Filtrar por ciudad (bogota, medellin, cali, manizales, ...)
  --save       Guardar resultado en exports/banrep-index.json
  --help       Mostrar esta ayuda

Ejemplos:
  npx tsx scripts/banrep-sitemap-index.ts --days=30
  npx tsx scripts/banrep-sitemap-index.ts --days=60 --city=bogota
  npx tsx scripts/banrep-sitemap-index.ts --save
`);
  process.exit(0);
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface SitemapEntry {
  url:     string;
  city:    string;
  slug:    string;
  lastmod: string | null;
  daysAgo: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractCity(url: string): string {
  try {
    const pathname = new URL(url).pathname;  // /{ciudad}/actividad/{slug}
    const parts    = pathname.split('/').filter(Boolean);
    return parts[0] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function extractSlug(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const parts    = pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? '';
  } catch {
    return '';
  }
}

function daysAgo(lastmod: string | null): number | null {
  if (!lastmod) return null;
  try {
    const ms = Date.now() - new Date(lastmod).getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

async function fetchSitemapPage(page: number): Promise<SitemapEntry[]> {
  const url = page === 0
    ? 'https://www.banrepcultural.org/sitemap.xml'
    : `https://www.banrepcultural.org/sitemap.xml?page=${page}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept':     'application/xml,text/xml,*/*',
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching sitemap page ${page}`);

  const xml = await res.text();
  const $   = cheerio.load(xml, { xmlMode: true });

  const entries: SitemapEntry[] = [];

  $('url').each((_, el) => {
    const rawUrl = $(el).find('loc').text().trim();
    const mod    = $(el).find('lastmod').text().trim() || null;

    // Solo URLs de actividades: /{ciudad}/actividad/{slug}
    if (!rawUrl.includes('/actividad/')) return;

    const city = extractCity(rawUrl);
    const slug = extractSlug(rawUrl);
    const ago  = daysAgo(mod);

    entries.push({ url: rawUrl, city, slug, lastmod: mod, daysAgo: ago });
  });

  return entries;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🗺️  Banrep Sitemap Index\n');
  console.log('   Fuente: banrepcultural.org/sitemap.xml (accesible sin bot-protection)');
  console.log('   Nota:   contenido de páginas bloqueado por Radware ShieldSquare\n');

  // 1. Detectar cuántas páginas tiene el sitemap
  console.log('📋 Leyendo índice de sitemaps...');
  const indexRes = await fetch('https://www.banrepcultural.org/sitemap.xml', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept':     'application/xml,text/xml,*/*',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!indexRes.ok) throw new Error(`No se pudo acceder al sitemap raíz: HTTP ${indexRes.status}`);

  const indexXml  = await indexRes.text();
  const $index    = cheerio.load(indexXml, { xmlMode: true });

  // Detectar si es sitemap index (con <sitemap>) o sitemap plano (con <url>)
  const sitemapLocs = $index('sitemap > loc').map((_, el) => $index(el).text().trim()).get();
  const isIndex     = sitemapLocs.length > 0;

  const allEntries: SitemapEntry[] = [];

  if (isIndex) {
    console.log(`   ${sitemapLocs.length} sub-sitemaps encontrados. Leyendo...`);
    for (let i = 0; i < sitemapLocs.length; i++) {
      const subUrl = sitemapLocs[i];
      // Extraer número de página del URL
      const pageMatch = subUrl.match(/page=(\d+)/);
      const pageNum   = pageMatch ? parseInt(pageMatch[1], 10) : i + 1;
      try {
        const entries = await fetchSitemapPage(pageNum);
        console.log(`   Página ${pageNum}: ${entries.length} actividades`);
        allEntries.push(...entries);
      } catch (err) {
        console.warn(`   ⚠️  Página ${pageNum}: ${err instanceof Error ? err.message : err}`);
      }
    }
  } else {
    // Sitemap plano — parsear directamente
    $index('url').each((_, el) => {
      const rawUrl = $index(el).find('loc').text().trim();
      const mod    = $index(el).find('lastmod').text().trim() || null;
      if (!rawUrl.includes('/actividad/')) return;
      allEntries.push({
        url:     rawUrl,
        city:    extractCity(rawUrl),
        slug:    extractSlug(rawUrl),
        lastmod: mod,
        daysAgo: daysAgo(mod),
      });
    });
    console.log(`   Sitemap plano: ${allEntries.length} actividades`);
  }

  console.log(`\n✅ Total actividades indexadas: ${allEntries.length}\n`);

  // 2. Aplicar filtros
  let filtered = allEntries;

  if (daysFilter > 0) {
    filtered = filtered.filter(e => e.daysAgo !== null && e.daysAgo <= daysFilter);
    console.log(`📅 Filtro --days=${daysFilter}: ${filtered.length} actividades actualizadas recientemente`);
  }

  if (cityFilter) {
    filtered = filtered.filter(e => e.city.toLowerCase() === cityFilter);
    console.log(`🏙️  Filtro --city=${cityFilter}: ${filtered.length} actividades`);
  }

  // 3. Estadísticas por ciudad
  console.log('\n📊 Distribución por ciudad (total sin filtros de fecha):');
  const cityCount = new Map<string, number>();
  for (const e of allEntries) {
    cityCount.set(e.city, (cityCount.get(e.city) ?? 0) + 1);
  }
  const sortedCities = [...cityCount.entries()].sort((a, b) => b[1] - a[1]);
  for (const [city, count] of sortedCities.slice(0, 15)) {
    const bar = '█'.repeat(Math.min(20, Math.round(count / 10)));
    console.log(`   ${city.padEnd(20)} ${String(count).padStart(4)}  ${bar}`);
  }
  if (sortedCities.length > 15) {
    console.log(`   ... y ${sortedCities.length - 15} ciudades más`);
  }

  // 4. Freshness stats
  const withDate   = allEntries.filter(e => e.daysAgo !== null);
  const last30     = withDate.filter(e => e.daysAgo! <= 30);
  const last90     = withDate.filter(e => e.daysAgo! <= 90);
  const last180    = withDate.filter(e => e.daysAgo! <= 180);

  console.log('\n📅 Freshness del catálogo:');
  console.log(`   Últimos 30 días  : ${last30.length} actividades`);
  console.log(`   Últimos 90 días  : ${last90.length} actividades`);
  console.log(`   Últimos 180 días : ${last180.length} actividades`);
  console.log(`   Con lastmod      : ${withDate.length}/${allEntries.length}`);

  // 5. Muestra de los más recientes
  const recent = [...withDate]
    .sort((a, b) => (a.daysAgo ?? 999) - (b.daysAgo ?? 999))
    .slice(0, 10);

  if (recent.length > 0) {
    console.log('\n🕐 Más recientes:');
    for (const e of recent) {
      console.log(`   ${String(e.daysAgo).padStart(3)}d  [${e.city}]  ${e.slug.slice(0, 55)}`);
    }
  }

  // 6. Guardar si --save
  if (saveFlag) {
    const outDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const outPath = path.join(outDir, 'banrep-index.json');
    const payload = {
      generatedAt:  new Date().toISOString(),
      totalIndexed: allEntries.length,
      filters:      { days: daysFilter || null, city: cityFilter || null },
      entries:      filtered,
    };
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`\n💾 Guardado en exports/banrep-index.json (${filtered.length} entradas)`);
  }

  // 7. Resumen para outreach dossier
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Para dossier de outreach institucional:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Actividades culturales indexadas : ${allEntries.length}
   Ciudades cubiertas               : ${sortedCities.length}
   Actualizadas últimos 90 días     : ${last90.length}
   Cobertura geográfica             : nacional

   → Si Banrep comparte feed/API:
     HabitaPlan obtiene ~${last90.length} actividades activas en ${sortedCities.length} ciudades
     sin coste de scraping ni cuota Gemini.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch(err => {
  console.error('❌ Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
