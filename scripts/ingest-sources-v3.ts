// ingest-sources-v3.ts
// Pipeline V3 — Cobertura completa de fuentes de listado puro.
//
// Diferencias vs V2:
//   - processAllLinks: true para fuentes PURE_LISTING (BibloRed, Idartes, Alcaldía agenda)
//     → bypass del ranking: todos los links van a Gemini discover sin cap por presupuesto
//     → cap duro de 500 URLs como guardrail operacional
//   - processAllLinks: false para MIXED → mismo comportamiento que V2 (ranking activo)
//   - Métricas de cobertura post-run por fuente: discovered, processed, persisted,
//     review_queue, db_delta, avg_parse_time
//
// V1 (ingest-sources.ts) y V2 (ingest-sources-v2.ts) NO son modificados.
// El gate V2 sigue activo: recall-first, institucionales → PENDING_REVIEW si score bajo.
//
// Clasificación de fuentes:
//   PURE_LISTING : listado editorialmente curado, >90% links son eventos. processAllLinks=true.
//   MIXED        : homepage o sección con nav + noticias + eventos mezclados. ranking activo.
//   SOCIAL       : Instagram/redes. Discovery exploratorio, gates fuertes.
//
// Uso:
//   npx tsx scripts/ingest-sources-v3.ts --list
//   npx tsx scripts/ingest-sources-v3.ts --source=biblored --save-db
//   npx tsx scripts/ingest-sources-v3.ts --source=biblored,idartes --save-db
//   npx tsx scripts/ingest-sources-v3.ts --channel=web --save-db
//   npx tsx scripts/ingest-sources-v3.ts --source=biblored --dry-run

import 'dotenv/config';
import { ScrapingPipeline } from '../src/modules/scraping/pipeline';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { quota } from '../src/lib/quota-tracker';

type Channel    = 'web' | 'instagram' | 'tiktok' | 'facebook' | 'telegram';
type SourceType = 'pure_listing' | 'mixed' | 'social';

const SOCIAL_CHANNELS: Channel[] = ['instagram', 'tiktok', 'facebook'];

interface Source {
  name:             string;
  channel:          Channel;
  url:              string;
  cityName?:        string;
  verticalSlug?:    string;
  sitemapPatterns?: string[];
  maxPages?:        number;
  processAllLinks?: boolean; // true = bypass ranking, full coverage
  sourceType:       SourceType;
}

// ── Catálogo de fuentes V3 ────────────────────────────────────────────────────
//
// PURE_LISTING → processAllLinks: true
//   El ranking fue diseñado para páginas mixtas (nav + noticias + eventos).
//   En un listado puro, el 100% de los links ya son eventos por construcción —
//   el ranking no filtra ruido sino que se convierte en limitador de cobertura.
//
// MIXED → ranking activo (processAllLinks: false)
//   Páginas con nav, contenido institucional y eventos mezclados.
//   El ranking sigue siendo útil para filtrar ruido antes de gastar cuota Gemini.
//
// SOCIAL → discovery exploratorio
//   Instagram/redes sociales. El filtro isLikelyInstagramEvent ya pre-filtra.

const ALL_SOURCES: Source[] = [

  // ── PURE_LISTING ──────────────────────────────────────────────────────────
  {
    name:            'BibloRed',
    channel:         'web',
    url:             'https://www.biblored.gov.co/eventos',
    cityName:        'Bogotá',
    maxPages:        50,   // BibloRed tiene 9 páginas reales — 50 cubre holgado
    processAllLinks: true,
    sourceType:      'pure_listing',
  },
  {
    name:            'Idartes',
    channel:         'web',
    url:             'https://www.idartes.gov.co/es/agenda',
    cityName:        'Bogotá',
    maxPages:        50,
    processAllLinks: true,
    sourceType:      'pure_listing',
  },
  {
    // Solo esta ruta exacta — el resto de bogota.gov.co es contenido mixto
    name:            'Alcaldía de Bogotá — Agenda Cultural',
    channel:         'web',
    url:             'https://bogota.gov.co/que-hacer/agenda-cultural',
    cityName:        'Bogotá',
    maxPages:        50,
    processAllLinks: true,
    sourceType:      'pure_listing',
  },

  // ── MIXED ─────────────────────────────────────────────────────────────────
  {
    name:       'Planetario',
    channel:    'web',
    url:        'https://planetariodebogota.gov.co',
    cityName:   'Bogotá',
    sourceType: 'mixed',
  },
  {
    name:       'Cinemateca',
    channel:    'web',
    url:        'https://cinematecadebogota.gov.co',
    cityName:   'Bogotá',
    sourceType: 'mixed',
  },
  {
    name:       'Banrep Bogotá',
    channel:    'web',
    url:        'https://www.banrepcultural.org/bogota',
    cityName:   'Bogotá',
    sourceType: 'mixed',
  },
  {
    name:       'FCE Bogotá',
    channel:    'web',
    url:        'https://fce.com.co/programacion-cultural',
    cityName:   'Bogotá',
    sourceType: 'mixed',
  },
  {
    name:       'JBB',
    channel:    'web',
    url:        'https://jbb.gov.co',
    cityName:   'Bogotá',
    sourceType: 'mixed',
  },
  {
    name:       'SCRD',
    channel:    'web',
    url:        'https://www.culturarecreacionydeporte.gov.co/es/agenda-cultural',
    cityName:   'Bogotá',
    sourceType: 'mixed',
  },
  {
    name:       'Parque Explora',
    channel:    'web',
    url:        'https://parqueexplora.org',
    cityName:   'Medellín',
    sourceType: 'mixed',
  },

  // ── SOCIAL ────────────────────────────────────────────────────────────────
  {
    name:       'IG: quehaypahacerenbogota',
    channel:    'instagram',
    url:        'https://www.instagram.com/quehaypahacerenbogota',
    cityName:   'Bogotá',
    sourceType: 'social',
  },
  {
    name:       'IG: quehacerenmedellin',
    channel:    'instagram',
    url:        'https://www.instagram.com/quehacerenmedellin',
    cityName:   'Medellín',
    sourceType: 'social',
  },
];

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun    = args.includes('--dry-run');
const listMode  = args.includes('--list');
const saveDb    = args.includes('--save-db') && !dryRun;

const channelArg  = args.find(a => a.startsWith('--channel='))?.replace('--channel=', '');
const sourceArg   = args.find(a => a.startsWith('--source='))?.replace('--source=', '');
const maxPagesArg = parseInt(
  args.find(a => a.startsWith('--max-pages='))?.replace('--max-pages=', '') ?? '10'
);

const channelFilters: Channel[] = channelArg
  ? channelArg.split(',').flatMap(c => c === 'social' ? SOCIAL_CHANNELS : [c as Channel])
  : [];
const sourceFilters: string[] = sourceArg
  ? sourceArg.split(',').map(s => s.trim().toLowerCase())
  : [];

function matchesFilter(s: Source): boolean {
  const byChannel = channelFilters.length === 0 || channelFilters.includes(s.channel);
  const bySource  = sourceFilters.length  === 0 || sourceFilters.some(f => s.name.toLowerCase().includes(f));
  return byChannel && bySource;
}

// ── List mode ─────────────────────────────────────────────────────────────────
if (listMode) {
  console.log('\n📋 Fuentes disponibles — Pipeline V3\n');
  const labels: Record<SourceType, string> = {
    pure_listing: '🎯 PURE_LISTING (processAllLinks=true, cap 500)',
    mixed:        '🔀 MIXED (ranking activo)',
    social:       '📱 SOCIAL (discovery exploratorio)',
  };
  for (const type of ['pure_listing', 'mixed', 'social'] as SourceType[]) {
    const group = ALL_SOURCES.filter(s => s.sourceType === type);
    if (group.length === 0) continue;
    console.log(`\n${labels[type]}`);
    for (const s of group) {
      console.log(`  • ${s.name} (${s.cityName ?? 'N/A'})`);
    }
  }
  console.log();
  process.exit(0);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const adapter    = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prismaLocal = new PrismaClient({ adapter });

  const selected = ALL_SOURCES.filter(matchesFilter);
  if (selected.length === 0) {
    console.error('❌ Ninguna fuente coincide con los filtros.');
    process.exit(1);
  }

  const remaining = await quota.getRemaining();
  console.log(`\n🤖 Pipeline V3 — ${selected.length} fuente(s) | Cuota Gemini: ${remaining} req restantes`);
  if (remaining <= 0) {
    console.error('❌ Cuota Gemini agotada. Espera el reset (08:00 UTC).');
    process.exit(1);
  }

  if (dryRun)  console.log('🔍 Modo DRY-RUN: descubriendo sin guardar');
  if (!saveDb) console.log('ℹ️  Sin --save-db: no se guarda en BD');

  console.log('🔁 Gate V2 activo | PURE_LISTING=cobertura completa | MIXED=ranking\n');

  // Métricas acumuladas de la sesión completa
  let totalDiscovered = 0;
  let totalProcessed  = 0;
  let totalPersisted  = 0;
  let totalPending    = 0;
  let totalDbDelta    = 0;

  for (const source of selected) {
    const typeIcon = { pure_listing: '🎯', mixed: '🔀', social: '📱' }[source.sourceType];
    console.log(`\n▶ ${typeIcon} ${source.name} (${source.channel}) — ${source.url}`);
    if (source.processAllLinks) {
      console.log(`  📌 processAllLinks=true — cobertura completa (cap 500)`);
    }

    const pipeline = new ScrapingPipeline({
      saveToDb:     saveDb,
      cityName:     source.cityName ?? 'Bogotá',
      verticalSlug: source.verticalSlug ?? 'kids',
      useGateV2:    true,
    });

    // Snapshot pre-run para calcular db_delta real
    let beforeCount = 0;
    if (saveDb) {
      try {
        const domain = new URL(source.url).hostname.replace('www.', '');
        beforeCount = await prismaLocal.activity.count({ where: { sourceDomain: domain } });
      } catch { /* non-fatal */ }
    }

    const startMs = Date.now();

    try {
      if (source.channel === 'instagram') {
        const result = await pipeline.runInstagramPipeline(source.url, { maxPosts: 20 });
        const saved = result.savedCount ?? 0;
        console.log(`  ✅ Instagram: ${saved} guardadas`);
        totalPersisted += saved;

      } else {
        const result = await pipeline.runBatchPipeline(source.url, {
          maxPages:        source.maxPages ?? maxPagesArg,
          sitemapPatterns: source.sitemapPatterns,
          processAllLinks: source.processAllLinks ?? false,
        });

        const elapsedSec = (Date.now() - startMs) / 1000;
        const discovered = result.discoveredLinks ?? 0;
        const processed  = result.results?.length ?? 0;
        const saved      = result.savedCount ?? 0;
        const detected   = result.results?.filter(r => r.data?.isActivity === true).length ?? 0;
        const pending    = Math.max(0, detected - saved);
        const avgParseMs = processed > 0 ? Math.round((elapsedSec * 1000) / processed) : 0;

        // db_delta: actividades realmente nuevas en BD (fuente de verdad)
        let dbDelta = 0;
        if (saveDb) {
          try {
            const domain = new URL(source.url).hostname.replace('www.', '');
            const afterCount = await prismaLocal.activity.count({ where: { sourceDomain: domain } });
            dbDelta = afterCount - beforeCount;
          } catch { /* non-fatal */ }
        }

        console.log(`  📊 Métricas:`);
        console.log(`     discovered_total : ${discovered}`);
        console.log(`     processed_total  : ${processed}`);
        console.log(`     persisted_total  : ${saved}`);
        console.log(`     review_queue     : ~${pending}`);
        console.log(`     db_delta         : +${dbDelta} nuevas en BD`);
        console.log(`     avg_parse_time   : ${avgParseMs}ms/URL`);
        console.log(`     elapsed          : ${elapsedSec.toFixed(1)}s`);

        totalDiscovered += discovered;
        totalProcessed  += processed;
        totalPersisted  += saved;
        totalPending    += pending;
        totalDbDelta    += dbDelta;
      }
    } catch (err) {
      console.error(`  ❌ Error en ${source.name}:`, err instanceof Error ? err.message : err);
    } finally {
      await pipeline.disconnect();
    }
  }

  await prismaLocal.$disconnect();

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ V3 completado`);
  console.log(`   discovered_total  : ${totalDiscovered}`);
  console.log(`   processed_total   : ${totalProcessed}`);
  console.log(`   persisted_total   : ${totalPersisted}`);
  console.log(`   review_queue      : ~${totalPending}`);
  console.log(`   db_delta          : +${totalDbDelta} nuevas en BD (neto sesión)`);
  console.log(`   Pendientes humanos: /admin/pending-review`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
