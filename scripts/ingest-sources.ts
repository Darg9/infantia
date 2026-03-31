// ingest-sources.ts
// Ingesta de múltiples fuentes.
// Uso: npx tsx scripts/ingest-sources.ts [opciones]
//
// Opciones de selección (combinables):
//   --channel=CANAL    Filtra por canal. Canales disponibles:
//                        web       → sitios web scrapeados con Cheerio/Playwright
//                        instagram → cuentas de Instagram
//                        tiktok    → cuentas de TikTok
//                        facebook  → páginas de Facebook
//                        social    → alias: todas las redes sociales
//                      Se puede pasar una lista: --channel=web,instagram
//   --source=NOMBRE    Filtra por nombre (parcial, sin importar mayúsculas)
//                      Se puede pasar una lista: --source=banrep,cinemateca
//   Nota: --channel y --source son acumulativos (AND). Si se combinan,
//         se ejecutan las fuentes que cumplan ambos filtros.
//
// Otras opciones:
//   --list           Muestra el inventario de fuentes agrupado por canal y sale
//   --dry-run        Descubre links pero NO guarda en BD
//   --max-pages=N    Páginas máximas por fuente (default: 10)
//   --queue          Encola jobs en Redis/BullMQ (requiere worker corriendo)
//   --save-db        Alias explícito de "guardar en BD" (comportamiento por defecto)
//
// Ejemplos:
//   npx tsx scripts/ingest-sources.ts --list
//   npx tsx scripts/ingest-sources.ts --channel=web --save-db
//   npx tsx scripts/ingest-sources.ts --channel=social
//   npx tsx scripts/ingest-sources.ts --source=banrep --save-db
//   npx tsx scripts/ingest-sources.ts --source=banrep,cinemateca --save-db
//   npx tsx scripts/ingest-sources.ts --channel=web --source=banrep --save-db

import 'dotenv/config';
import { ScrapingPipeline } from '../src/modules/scraping/pipeline';
import { enqueueBatchJob, closeScrapingQueue, closeRedisConnection } from '../src/modules/scraping/queue';

type Channel = 'web' | 'instagram' | 'tiktok' | 'facebook';

const SOCIAL_CHANNELS: Channel[] = ['instagram', 'tiktok', 'facebook'];

const CHANNEL_ICON: Record<Channel, string> = {
  web:       '🌐',
  instagram: '📸',
  tiktok:    '🎵',
  facebook:  '📘',
};

interface Source {
  name:             string;
  channel:          Channel;
  url:              string;
  cityName?:        string;
  verticalSlug?:    string;
  sitemapPatterns?: string[];
}

// ── Ciudades Banrep ────────────────────────────────────────────────────────────
const BANREP_CITIES: { cityName: string; slug: string }[] = [
  { cityName: 'Bogotá',       slug: 'bogota'       },
  { cityName: 'Medellín',     slug: 'medellin'     },
  { cityName: 'Cali',         slug: 'cali'         },
  { cityName: 'Barranquilla', slug: 'barranquilla' },
  { cityName: 'Cartagena',    slug: 'cartagena'    },
  { cityName: 'Bucaramanga',  slug: 'bucaramanga'  },
  { cityName: 'Manizales',    slug: 'manizales'    },
  { cityName: 'Pereira',      slug: 'pereira'      },
  { cityName: 'Ibagué',       slug: 'ibague'       },
  { cityName: 'Santa Marta',  slug: 'santa-marta'  },
];

// ── Catálogo de fuentes ────────────────────────────────────────────────────────
// Orden = prioridad de ejecución. Banrep va primero para aprovechar cuota Gemini.
const ALL_SOURCES: Source[] = [

  // ── web: Banco de la República (10 ciudades) ─────────────────────────────
  ...BANREP_CITIES.map(({ cityName, slug }): Source => ({
    name:            `Banrep — ${cityName}`,
    channel:         'web',
    url:             'https://www.banrepcultural.org/sitemap.xml',
    cityName,
    verticalSlug:    'kids',
    sitemapPatterns: [`/${slug}/`],
  })),

  // ── web: Bogotá — otras instituciones ────────────────────────────────────
  { name: 'Cinemateca de Bogotá',  channel: 'web', url: 'https://cinematecadebogota.gov.co/agenda/11',           cityName: 'Bogotá', verticalSlug: 'kids' },
  { name: 'Planetario de Bogotá',  channel: 'web', url: 'https://planetariodebogota.gov.co/programate',           cityName: 'Bogotá', verticalSlug: 'kids' },
  { name: 'Jardín Botánico (JBB)', channel: 'web', url: 'https://jbb.gov.co/eventos/agenda-cultural-academica/', cityName: 'Bogotá', verticalSlug: 'kids' },
  { name: 'Maloka',                channel: 'web', url: 'https://maloka.org/programacion/',                       cityName: 'Bogotá', verticalSlug: 'kids' },

  // ── instagram ─────────────────────────────────────────────────────────────
  // Ejemplo (descomentar cuando esté listo el scraper de Instagram):
  // { name: 'BibloRed Instagram', channel: 'instagram', url: 'https://www.instagram.com/biblored/', cityName: 'Bogotá', verticalSlug: 'kids' },

  // ── tiktok ────────────────────────────────────────────────────────────────
  // (pendiente)

  // ── facebook ──────────────────────────────────────────────────────────────
  // (pendiente)
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Imprime el inventario de fuentes agrupado por canal y sale. */
function printList() {
  console.log(`\n📋 ${ALL_SOURCES.length} fuentes disponibles\n`);

  const channels: Channel[] = ['web', 'instagram', 'tiktok', 'facebook'];
  for (const ch of channels) {
    const sources = ALL_SOURCES.filter((s) => s.channel === ch);
    const icon = CHANNEL_ICON[ch];
    console.log(`  ${icon} ${ch} (${sources.length})`);
    if (sources.length === 0) {
      console.log('    (ninguna aún)');
    } else {
      for (const s of sources) {
        const host = new URL(s.url).hostname.replace('www.', '');
        console.log(`    ${s.name.padEnd(32)} ${host}`);
      }
    }
    console.log();
  }
}

/** Resuelve el filtro --channel (soporta "social" como alias y listas separadas por coma). */
function resolveChannels(raw: string): Channel[] {
  const parts = raw.toLowerCase().split(',').map((p) => p.trim());
  const result = new Set<Channel>();
  for (const part of parts) {
    if (part === 'social') {
      SOCIAL_CHANNELS.forEach((c) => result.add(c));
    } else if (['web', 'instagram', 'tiktok', 'facebook'].includes(part)) {
      result.add(part as Channel);
    } else {
      console.error(`❌ Canal desconocido: "${part}". Opciones: web, instagram, tiktok, facebook, social`);
      process.exit(1);
    }
  }
  return [...result];
}

/** Aplica los filtros --channel y --source y devuelve las fuentes seleccionadas. */
function selectSources(channelArg: string | null, sourceArg: string | null): Source[] {
  let sources = [...ALL_SOURCES];

  if (channelArg) {
    const channels = resolveChannels(channelArg);
    sources = sources.filter((s) => channels.includes(s.channel));
  }

  if (sourceArg) {
    const names = sourceArg.toLowerCase().split(',').map((n) => n.trim());
    sources = sources.filter((s) => names.some((n) => s.name.toLowerCase().includes(n)));
  }

  if (sources.length === 0) {
    console.error('❌ Ninguna fuente coincide con los filtros aplicados.');
    console.error('   Usa --list para ver las fuentes disponibles.');
    process.exit(1);
  }

  return sources;
}

// ── Runners ────────────────────────────────────────────────────────────────────

async function runDirect(sources: Source[], dryRun: boolean, maxPages: number) {
  console.log(`\n🚀 INGESTA SECUENCIAL — ${sources.length} fuentes`);
  console.log(`   Modo: ${dryRun ? 'DRY RUN (sin guardar)' : 'GUARDAR EN BD'}`);
  console.log(`   Páginas máx por fuente: ${maxPages}\n`);

  const summary: { name: string; saved: number; failed: number; skipped: number }[] = [];

  for (const source of sources) {
    const icon = CHANNEL_ICON[source.channel];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${icon} ${source.name}`);
    console.log(`  ${source.url}`);
    console.log('='.repeat(60));

    const pipeline = new ScrapingPipeline({ saveToDb: !dryRun, cityName: source.cityName, verticalSlug: source.verticalSlug });
    try {
      const result = await pipeline.runBatchPipeline(source.url, { maxPages, sitemapPatterns: source.sitemapPatterns });
      const saved   = result.results.filter((r) => r.data).length;
      const failed  = result.results.filter((r) => !r.data).length;
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
    console.log(`  ${s.name.padEnd(32)} ✅ ${s.saved} guardadas  ❌ ${s.failed} fallidas`);
  }
  const totalSaved = summary.reduce((acc, s) => acc + s.saved, 0);
  console.log(`\n  TOTAL NUEVAS: ${totalSaved} actividades\n`);
}

async function runQueue(sources: Source[], maxPages: number) {
  console.log(`\n🚀 ENCOLANDO — ${sources.length} fuentes en Redis/BullMQ`);
  console.log(`   Páginas máx por fuente: ${maxPages}`);
  console.log(`   Asegúrate de que el worker esté corriendo: npx tsx scripts/run-worker.ts\n`);

  for (const source of sources) {
    const id = await enqueueBatchJob({
      url:             source.url,
      cityName:        source.cityName ?? 'Bogotá',
      verticalSlug:    source.verticalSlug ?? 'kids',
      maxPages,
      sitemapPatterns: source.sitemapPatterns,
    });
    console.log(`  ✅ ${source.name.padEnd(32)} → job ${id}`);
  }

  console.log(`\n  ${sources.length} jobs encolados. El worker los procesa secuencialmente.\n`);
  await closeScrapingQueue();
  await closeRedisConnection();
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // --list
  if (args.includes('--list')) {
    printList();
    return;
  }

  const dryRun     = args.includes('--dry-run');
  const useQueue   = args.includes('--queue');
  const maxPagesArg = args.find((a) => a.startsWith('--max-pages='));
  const maxPages   = maxPagesArg ? parseInt(maxPagesArg.split('=')[1], 10) : 10;

  const channelArg = args.find((a) => a.startsWith('--channel='))?.split('=')[1] ?? null;
  const sourceArg  = args.find((a) => a.startsWith('--source='))?.split('=')[1]  ?? null;

  const sources = selectSources(channelArg, sourceArg);

  if (channelArg || sourceArg) {
    const label = [
      channelArg && `canal="${channelArg}"`,
      sourceArg  && `source="${sourceArg}"`,
    ].filter(Boolean).join(' + ');
    console.log(`🔍 Filtros activos [${label}]: ${sources.length}/${ALL_SOURCES.length} fuentes seleccionadas`);
    for (const s of sources) console.log(`   ${CHANNEL_ICON[s.channel]} ${s.name}`);
  }

  if (useQueue) {
    await runQueue(sources, maxPages);
  } else {
    await runDirect(sources, dryRun, maxPages);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
