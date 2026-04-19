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
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

type Channel = 'web' | 'instagram' | 'tiktok' | 'facebook' | 'telegram';

const SOCIAL_CHANNELS: Channel[] = ['instagram', 'tiktok', 'facebook'];

const CHANNEL_ICON: Record<Channel, string> = {
  web:       '🌐',
  instagram: '📸',
  tiktok:    '🎵',
  facebook:  '📘',
  telegram:  '✈️',
};

interface Source {
  name:             string;
  channel:          Channel;
  url:              string;
  cityName?:        string;
  verticalSlug?:    string;
  sitemapPatterns?: string[];
  /** Solo para channel='instagram': opciones de extracción por fuente */
  instagram?: {
    /** Qué contenido extraer: 'text' (solo caption), 'image' (solo imágenes), 'both'. Default: 'text' */
    contentMode?: 'text' | 'image' | 'both';
    /** Posts a procesar por corrida (1–12). Default: 6 */
    maxPosts?: number;
  };
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
  // { cityName: 'Ibagué',    slug: 'ibague'       }, // pausada S34: cuota Gemini se agota antes de llegar a Ibagué (score 13/100)
  { cityName: 'Santa Marta',  slug: 'santa-marta'  },
];

// ── Catálogo de fuentes ────────────────────────────────────────────────────────
// Orden = prioridad de ejecución.
// Bogotá institucional primero (mayor volumen + cuota Gemini), luego Banrep
// otras ciudades, luego Medellín web, luego fuentes secundarias.
const ALL_SOURCES: Source[] = [

  // ── web: Bogotá — instituciones principales ───────────────────────────────
  { name: 'BibloRed',                           channel: 'web', url: 'https://www.biblored.gov.co/eventos',                              cityName: 'Bogotá', verticalSlug: 'kids' },
  { name: 'Sec. de Cultura, Recreación y Dep.', channel: 'web', url: 'https://www.culturarecreacionydeporte.gov.co/es/agenda-cultural',  cityName: 'Bogotá', verticalSlug: 'kids' },
  // Banrep Bogotá inline (antes que otras ciudades)
  { name: 'Banrep — Bogotá',                    channel: 'web', url: 'https://www.banrepcultural.org/sitemap.xml',                       cityName: 'Bogotá', verticalSlug: 'kids', sitemapPatterns: ['/bogota/'] },
  { name: 'Alcaldía de Bogotá',                 channel: 'web', url: 'https://bogota.gov.co/mi-ciudad/cultura-recreacion-y-deporte',     cityName: 'Bogotá', verticalSlug: 'kids' },
  { name: 'Cinemateca de Bogotá',               channel: 'web', url: 'https://cinematecadebogota.gov.co/agenda/11',                      cityName: 'Bogotá', verticalSlug: 'kids' },
  { name: 'Idartes',                            channel: 'web', url: 'https://www.idartes.gov.co/es/agenda',                             cityName: 'Bogotá', verticalSlug: 'kids' },
  { name: 'Planetario de Bogotá',               channel: 'web', url: 'https://planetariodebogota.gov.co/programate',                     cityName: 'Bogotá', verticalSlug: 'kids' },
  { name: 'Maloka',                             channel: 'web', url: 'https://maloka.org/programacion/',                                 cityName: 'Bogotá', verticalSlug: 'kids' },
  { name: 'Jardín Botánico (JBB)',              channel: 'web', url: 'https://jbb.gov.co/eventos/agenda-cultural-academica/',            cityName: 'Bogotá', verticalSlug: 'kids' },
  { name: 'FCE Colombia',                       channel: 'web', url: 'https://www.fce.com.co/filbo/agenda/',                             cityName: 'Bogotá', verticalSlug: 'kids' },

  // ── web: Banco de la República (otras ciudades) ───────────────────────────
  ...BANREP_CITIES.filter((c) => c.cityName !== 'Bogotá').map(({ cityName, slug }): Source => ({
    name:            `Banrep — ${cityName}`,
    channel:         'web',
    url:             'https://www.banrepcultural.org/sitemap.xml',
    cityName,
    verticalSlug:    'kids',
    sitemapPatterns: [`/${slug}/`],
  })),

  // ── web: Medellín ─────────────────────────────────────────────────────────
  // Parque Explora — sitemap con 700+ eventos individuales bajo /programate/
  { name: 'Parque Explora',    channel: 'web', url: 'https://www.parqueexplora.org/sitemap.xml',    cityName: 'Medellín', verticalSlug: 'kids', sitemapPatterns: ['/programate/'] },
  // Biblioteca Piloto — sitemap + SSR Next.js, eventos niños/familias bajo /agenda/
  { name: 'Biblioteca Piloto', channel: 'web', url: 'https://bibliotecapiloto.gov.co/sitemap.xml', cityName: 'Medellín', verticalSlug: 'kids', sitemapPatterns: ['/agenda/'] },

  // Pendientes Medellín (verificar disponibilidad):
  // { name: 'Sec. Cultura Antioquia', channel: 'web', url: 'https://www.culturaantioquia.gov.co/agenda',     cityName: 'Medellín', verticalSlug: 'kids' }, // ECONNREFUSED
  // { name: 'Alcaldía de Medellín',   channel: 'web', url: 'https://www.medellin.gov.co/es/eventos/',        cityName: 'Medellín', verticalSlug: 'kids' }, // WordPress+Elementor JS
  // { name: 'Jardín Botánico MDE',    channel: 'web', url: 'https://www.jardinbotanicodemedellin.gov.co',    cityName: 'Medellín', verticalSlug: 'kids' }, // ECONNREFUSED
  // { name: 'Museo de Antioquia',     channel: 'web', url: 'https://museodeantioquia.co/sitemap.xml',        cityName: 'Medellín', verticalSlug: 'kids' }, // sin agenda estructurada
  // { name: 'Infolocal Comfenalco',   channel: 'web', url: 'https://infolocal.comfenalcoantioquia.com/index.php/agenda', cityName: 'Medellín', verticalSlug: 'kids' }, // 150 eventos, contenido mixto adultos

  // ── web: Bogotá — fuentes secundarias ────────────────────────────────────
  { name: 'FUGA — Filarmónica de Bogotá', channel: 'web', url: 'https://fuga.gov.co/agenda', cityName: 'Bogotá', verticalSlug: 'kids' },

  // ── instagram ─────────────────────────────────────────────────────────────
  // Opciones disponibles por fuente:
  //   instagram.contentMode: 'text' (default, ~12MB/cuenta) | 'image' | 'both' (~35MB/cuenta)
  //   instagram.maxPosts: 1–12 (default: 6)
  //
  // Institucionales / culturales
  // { name: 'BibloRed Instagram',      channel: 'instagram', url: 'https://www.instagram.com/biblored/',               cityName: 'Bogotá', verticalSlug: 'kids', instagram: { contentMode: 'text', maxPosts: 6 } },
  // { name: 'FCE Colombia',            channel: 'instagram', url: 'https://www.instagram.com/fcecolombia/',             cityName: 'Bogotá', verticalSlug: 'kids', instagram: { contentMode: 'both', maxPosts: 8 } },

  // Agenda / planes Bogotá
  { name: 'Hay pa hacer Bogotá',     channel: 'instagram', url: 'https://www.instagram.com/quehaypahacerenbogota/',   cityName: 'Bogotá', verticalSlug: 'kids', instagram: { contentMode: 'text', maxPosts: 12 } },
  { name: 'Plansitos Bogotá',        channel: 'instagram', url: 'https://www.instagram.com/plansitosbogota/',         cityName: 'Bogotá', verticalSlug: 'kids', instagram: { contentMode: 'text', maxPosts: 6 } },
  { name: 'Parchex Bogotá',          channel: 'instagram', url: 'https://www.instagram.com/parchexbogota/',           cityName: 'Bogotá', verticalSlug: 'kids', instagram: { contentMode: 'text', maxPosts: 6 } },
  { name: 'Bogotá Plan',             channel: 'instagram', url: 'https://www.instagram.com/bogotaplan/',              cityName: 'Bogotá', verticalSlug: 'kids', instagram: { contentMode: 'text', maxPosts: 6 } },
  { name: 'Planes en Bogotá',        channel: 'instagram', url: 'https://www.instagram.com/planesenbogotaa/',         cityName: 'Bogotá', verticalSlug: 'kids', instagram: { contentMode: 'text', maxPosts: 6 } },

  // Teatro / cultura / circense
  { name: 'Bogotá Teatral y Circense', channel: 'instagram', url: 'https://www.instagram.com/bogotateatralycircense/', cityName: 'Bogotá', verticalSlug: 'kids', instagram: { contentMode: 'text', maxPosts: 6 } },
  { name: 'Festi Encuentro',         channel: 'instagram', url: 'https://www.instagram.com/festiencuentro/',          cityName: 'Bogotá', verticalSlug: 'kids', instagram: { contentMode: 'text', maxPosts: 6 } },
  { name: 'Teatro Petra',            channel: 'instagram', url: 'https://www.instagram.com/teatropetra/',             cityName: 'Bogotá', verticalSlug: 'kids', instagram: { contentMode: 'text', maxPosts: 6 } },

  // Gobierno / jóvenes
  { name: 'Distrito Joven BTA',      channel: 'instagram', url: 'https://www.instagram.com/distritojovenbta/',       cityName: 'Bogotá', verticalSlug: 'kids', instagram: { contentMode: 'text', maxPosts: 6 } },

  // Cultura internacional
  { name: 'Centro del Japón',        channel: 'instagram', url: 'https://www.instagram.com/centrodeljapon/',         cityName: 'Bogotá', verticalSlug: 'kids', instagram: { contentMode: 'text', maxPosts: 6 } },

  // Espacio / barrio Chapinero (pendiente — posts extraídos son de @distrito_ch, revisar)
  // { name: 'El Bazar de Chapi',       channel: 'instagram', url: 'https://www.instagram.com/elbazardechapi/',         cityName: 'Bogotá', verticalSlug: 'kids', instagram: { contentMode: 'text', maxPosts: 6 } },
  // { name: 'Distrito CH',             channel: 'instagram', url: 'https://www.instagram.com/distrito_ch/',            cityName: 'Bogotá', verticalSlug: 'kids', instagram: { contentMode: 'text', maxPosts: 6 } },

  // ── instagram: Medellín ──────────────────────────────────────────────────
  // Validadas S34 con --validate-only (sin cuota Gemini)
  { name: 'Parque Explora IG',    channel: 'instagram', url: 'https://www.instagram.com/parqueexplora/',       cityName: 'Medellín', verticalSlug: 'kids', instagram: { contentMode: 'text', maxPosts: 8 } },  // 236K seg ✅
  { name: 'Qué hacer Medellín',  channel: 'instagram', url: 'https://www.instagram.com/quehacerenmedellin/', cityName: 'Medellín', verticalSlug: 'kids', instagram: { contentMode: 'text', maxPosts: 8 } },  // 168K seg ✅
  // @medellinplanes — 59 seguidores, inactiva desde 2023 ❌
  // @planesmedellin — 37 seguidores, 1 post desde 2021 ❌

  // ── tiktok ────────────────────────────────────────────────────────────────
  // (pendiente)

  // ── facebook ──────────────────────────────────────────────────────────────
  // (pendiente — requiere IPRoyal proxy)

  // ── telegram ──────────────────────────────────────────────────────────────
  // Nota: los canales Telegram se ingestán con: npx tsx scripts/ingest-telegram.ts
  // El canal 'telegram' aquí es solo para --list, no para runDirect/runQueue
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

async function saveMetrics(
  prisma: PrismaClient,
  source: Source,
  postsDetected: number,
  postsParsed: number,
  postsFailed: number,
  errorType: string | null,
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ingest_metrics" (source_id, source_name, channel, posts_detected, posts_parsed, posts_failed, error_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      new URL(source.url).hostname.replace('www.', ''),
      source.name,
      source.channel,
      postsDetected,
      postsParsed,
      postsFailed,
      errorType,
    );
  } catch {
    // métricas son best-effort — no bloquear ingest
  }
}

async function runDirect(sources: Source[], dryRun: boolean, maxPages: number) {
  console.log(`\n🚀 INGESTA SECUENCIAL — ${sources.length} fuentes`);
  console.log(`   Modo: ${dryRun ? 'DRY RUN (sin guardar)' : 'GUARDAR EN BD'}`);
  console.log(`   Páginas máx por fuente: ${maxPages}\n`);

  const connectionString = `${process.env.DATABASE_URL}`;
  const adapter = new PrismaPg({ connectionString });
  const metricsPrisma = new PrismaClient({ adapter });

  const summary: { name: string; saved: number; failed: number; skipped: number }[] = [];

  for (const source of sources) {
    const icon = CHANNEL_ICON[source.channel];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${icon} ${source.name}`);
    console.log(`  ${source.url}`);
    console.log('='.repeat(60));

    const pipeline = new ScrapingPipeline({ saveToDb: !dryRun, cityName: source.cityName, verticalSlug: source.verticalSlug });
    try {
      let saved = 0, failed = 0, skipped = 0;

      switch (source.channel) {
        case 'instagram': {
          const result = await pipeline.runInstagramPipeline(source.url, source.instagram ?? {});
          saved   = result.results.filter((r) => r.data).length;
          failed  = result.results.filter((r) => !r.data && r.error).length;
          skipped = result.postsExtracted - result.results.length;
          const errorType = result.results.some((r) => r.error?.includes('QUOTA_EXHAUSTED')) ? 'quota'
            : failed > 0 ? 'parse' : null;
          await saveMetrics(metricsPrisma, source, result.postsExtracted, saved, failed, errorType);
          break;
        }
        case 'web':
        case 'tiktok':
        case 'facebook':
        case 'telegram': {
          const result = await pipeline.runBatchPipeline(source.url, { maxPages, sitemapPatterns: source.sitemapPatterns });
          saved   = result.results.filter((r) => r.data).length;
          failed  = result.results.filter((r) => !r.data).length;
          skipped = result.discoveredLinks - result.filteredLinks;
          const errorType = failed > 0 ? 'parse' : null;
          await saveMetrics(metricsPrisma, source, result.filteredLinks, saved, failed, errorType);
          break;
        }
        default:
          throw new Error(`Canal desconocido: ${(source as Source).channel}`);
      }

      summary.push({ name: source.name, saved, failed, skipped });
      console.log(`\n✅ ${source.name}: ${saved} guardadas, ${failed} fallidas, ${skipped} omitidas`);
    } catch (err: any) {
      const isQuota = err.message?.includes('QUOTA_EXHAUSTED');
      const errorType = isQuota ? 'quota' : 'network';
      await saveMetrics(metricsPrisma, source, 0, 0, 1, errorType);
      console.error(`\n❌ Error fatal en ${source.name}: ${err.message}`);
      summary.push({ name: source.name, saved: 0, failed: 1, skipped: 0 });
    } finally {
      await pipeline.disconnect();
    }
  }

  await metricsPrisma.$disconnect();

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

  const { prisma } = require('../src/lib/db');
  const { getCTRByDomain, ctrToBoost } = await import('../src/modules/analytics/metrics');

  const [healthData, ctrMap] = await Promise.all([
    prisma.sourceHealth.findMany({ select: { source: true, score: true } }),
    getCTRByDomain(),
  ]);
  const healthDict: Record<string, number> = {};
  for (const h of healthData) {
    healthDict[h.source] = h.score;
  }

  for (const source of sources) {
    const host = new URL(source.url).hostname.replace('www.', '');
    const score = healthDict[host] ?? 0.5; // neutral fallback

    // Prioridad base por salud de la fuente (1=Alta, 2=Normal, 3=Baja)
    let healthPriority = 2;
    if (score > 0.8) healthPriority = 1;
    else if (score < 0.4) healthPriority = 3;

    // Prioridad por CTR real: fuentes con más conversión se scrapean primero
    const ctr = (ctrMap as Record<string, number>)[host] ?? 0;
    const ctrPriority = ctr > 0.3 ? 1 : ctr > 0.15 ? 2 : 3;

    // Combinar: Math.min toma el más prioritario (número menor = más urgente)
    const priority = Math.min(healthPriority, ctrPriority);

    const id = await enqueueBatchJob({
      url:             source.url,
      cityName:        source.cityName ?? 'Bogotá',
      verticalSlug:    source.verticalSlug ?? 'kids',
      maxPages,
      sitemapPatterns: source.sitemapPatterns,
    }, { priority });

    console.log(`  ✅ ${source.name.padEnd(32)} → job ${id} (P:${priority} health:${score.toFixed(2)} ctr:${ctr.toFixed(3)})`);
    console.info(JSON.stringify({ event: 'ctr_priority_applied', domain: host, ctr, priority }));
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
