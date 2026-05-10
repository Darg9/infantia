// ingest-sources-v3.ts
// Pipeline V3 — Cobertura completa de fuentes de listado puro.
//
// Diferencias vs V2:
//   - processAllLinks: true para fuentes PURE_LISTING (todas las institucionales)
//     -> bypass del ranking: todos los links van a Gemini discover sin cap por presupuesto
//     -> cap duro de 500 URLs como guardrail operacional
//   - Metricas de cobertura post-run: discovered, processed, persisted,
//     review_queue, db_delta, avg_parse_time
//
// V1 (ingest-sources.ts) y V2 (ingest-sources-v2.ts) NO son modificados.
// El gate V2 sigue activo: recall-first, institucionales -> PENDING_REVIEW si score bajo.
//
// Clasificacion de fuentes:
//   PURE_LISTING : listado editorialmente curado, >90% links son eventos. processAllLinks=true.
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
type SourceType = 'pure_listing' | 'social';

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

// --------------------------------------------------------------------------
// Catalogo de fuentes V3
//
// PURE_LISTING: paginas de listado editorialmente curadas donde >90% de los
// links son eventos. El ranking fue disenado para paginas mixtas — aqui solo
// limita cobertura sin agregar valor. processAllLinks=true.
//
// SOCIAL: Instagram/redes sociales. Discovery exploratorio, gates fuertes.
// --------------------------------------------------------------------------

const ALL_SOURCES: Source[] = [

  // ── PURE_LISTING — Bogota institucionales ─────────────────────────────────
  {
    name:            'BibloRed',
    channel:         'web',
    url:             'https://www.biblored.gov.co/eventos',
    cityName:        'Bogota',
    maxPages:        50,
    processAllLinks: true,
    sourceType:      'pure_listing',
  },
  {
    name:            'Idartes',
    channel:         'web',
    url:             'https://www.idartes.gov.co/es/agenda',
    cityName:        'Bogota',
    maxPages:        50,
    processAllLinks: true,
    sourceType:      'pure_listing',
  },
  {
    name:            'Alcaldia de Bogota — Agenda Cultural',
    channel:         'web',
    url:             'https://bogota.gov.co/que-hacer/agenda-cultural',
    cityName:        'Bogota',
    maxPages:        50,
    processAllLinks: true,
    sourceType:      'pure_listing',
  },
  {
    name:            'Planetario',
    channel:         'web',
    url:             'https://planetariodebogota.gov.co/programate',
    cityName:        'Bogota',
    maxPages:        50,
    processAllLinks: true,
    sourceType:      'pure_listing',
  },
  {
    name:            'Cinemateca',
    channel:         'web',
    url:             'https://cinematecadebogota.gov.co/cine/11',
    cityName:        'Bogota',
    maxPages:        50,
    processAllLinks: true,
    sourceType:      'pure_listing',
  },
  {
    name:            'Banrep Bogota',
    channel:         'web',
    url:             'https://www.banrepcultural.org/actividades',
    cityName:        'Bogota',
    maxPages:        50,
    processAllLinks: true,
    sourceType:      'pure_listing',
  },
  {
    name:            'FCE Bogota',
    channel:         'web',
    url:             'https://fce.com.co/programacion-cultural/',
    cityName:        'Bogota',
    maxPages:        50,
    processAllLinks: true,
    sourceType:      'pure_listing',
  },
  {
    name:            'JBB — Agenda Cultural y Academica',
    channel:         'web',
    url:             'https://jbb.gov.co/eventos/agenda-cultural-academica/',
    cityName:        'Bogota',
    maxPages:        50,
    processAllLinks: true,
    sourceType:      'pure_listing',
  },
  {
    name:            'JBB — Eventos',
    channel:         'web',
    url:             'https://jbb.gov.co/eventos/',
    cityName:        'Bogota',
    maxPages:        50,
    processAllLinks: true,
    sourceType:      'pure_listing',
  },
  {
    name:            'SCRD — Eventos',
    channel:         'web',
    url:             'https://www.culturarecreacionydeporte.gov.co/es/eventos',
    cityName:        'Bogota',
    maxPages:        50,
    processAllLinks: true,
    sourceType:      'pure_listing',
  },
  {
    name:            'SCRD — Centro Felicidad Chapinero',
    channel:         'web',
    url:             'https://www.culturarecreacionydeporte.gov.co/es/centro-felicidad-chapinero/eventos',
    cityName:        'Bogota',
    maxPages:        50,
    processAllLinks: true,
    sourceType:      'pure_listing',
  },

  // ── PURE_LISTING — Medellin institucionales ───────────────────────────────
  {
    name:            'Parque Explora',
    channel:         'web',
    url:             'https://www.parqueexplora.org/en/programate',
    cityName:        'Medellin',
    maxPages:        50,
    processAllLinks: true,
    sourceType:      'pure_listing',
  },

  // ── SOCIAL ────────────────────────────────────────────────────────────────
  {
    name:       'IG: quehaypahacerenbogota',
    channel:    'instagram',
    url:        'https://www.instagram.com/quehaypahacerenbogota',
    cityName:   'Bogota',
    sourceType: 'social',
  },
  {
    name:       'IG: quehacerenmedellin',
    channel:    'instagram',
    url:        'https://www.instagram.com/quehacerenmedellin',
    cityName:   'Medellin',
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
  console.log('\nFuentes disponibles — Pipeline V3\n');
  const groups: Record<SourceType, string> = {
    pure_listing: 'PURE_LISTING (processAllLinks=true, cap 500)',
    social:       'SOCIAL (discovery exploratorio)',
  };
  for (const type of ['pure_listing', 'social'] as SourceType[]) {
    const group = ALL_SOURCES.filter(s => s.sourceType === type);
    if (group.length === 0) continue;
    console.log(`\n${groups[type]}`);
    for (const s of group) {
      console.log(`  * ${s.name} (${s.cityName ?? 'N/A'}) — ${s.url}`);
    }
  }
  console.log();
  process.exit(0);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const adapter     = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prismaLocal = new PrismaClient({ adapter });

  const selected = ALL_SOURCES.filter(matchesFilter);
  if (selected.length === 0) {
    console.error('No hay fuentes que coincidan con los filtros.');
    process.exit(1);
  }

  const remaining = await quota.getRemaining();
  console.log(`\nPipeline V3 — ${selected.length} fuente(s) | Cuota Gemini: ${remaining} req restantes`);
  if (remaining <= 0) {
    console.error('Cuota Gemini agotada. Espera el reset (08:00 UTC).');
    process.exit(1);
  }

  if (dryRun)  console.log('DRY-RUN: descubriendo sin guardar');
  if (!saveDb) console.log('Sin --save-db: no se guarda en BD');
  console.log('Gate V2 activo | PURE_LISTING=cobertura completa (cap 500)\n');

  let totalDiscovered = 0;
  let totalProcessed  = 0;
  let totalPersisted  = 0;
  let totalPending    = 0;
  let totalDbDelta    = 0;

  for (const source of selected) {
    console.log(`\n> ${source.name} (${source.channel}) — ${source.url}`);
    if (source.processAllLinks) {
      console.log(`  processAllLinks=true — cobertura completa (cap 500)`);
    }

    const pipeline = new ScrapingPipeline({
      saveToDb:     saveDb,
      cityName:     source.cityName ?? 'Bogota',
      verticalSlug: source.verticalSlug ?? 'kids',
      useGateV2:    true,
    });

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
        console.log(`  Instagram: ${saved} guardadas`);
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

        let dbDelta = 0;
        if (saveDb) {
          try {
            const domain = new URL(source.url).hostname.replace('www.', '');
            const afterCount = await prismaLocal.activity.count({ where: { sourceDomain: domain } });
            dbDelta = afterCount - beforeCount;
          } catch { /* non-fatal */ }
        }

        console.log(`  Metricas:`);
        console.log(`    discovered_total : ${discovered}`);
        console.log(`    processed_total  : ${processed}`);
        console.log(`    persisted_total  : ${saved}`);
        console.log(`    review_queue     : ~${pending}`);
        console.log(`    db_delta         : +${dbDelta} nuevas en BD`);
        console.log(`    avg_parse_time   : ${avgParseMs}ms/URL`);
        console.log(`    elapsed          : ${elapsedSec.toFixed(1)}s`);

        totalDiscovered += discovered;
        totalProcessed  += processed;
        totalPersisted  += saved;
        totalPending    += pending;
        totalDbDelta    += dbDelta;
      }
    } catch (err) {
      console.error(`  Error en ${source.name}:`, err instanceof Error ? err.message : err);
    } finally {
      await pipeline.disconnect();
    }
  }

  await prismaLocal.$disconnect();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`V3 completado`);
  console.log(`  discovered_total  : ${totalDiscovered}`);
  console.log(`  processed_total   : ${totalProcessed}`);
  console.log(`  persisted_total   : ${totalPersisted}`);
  console.log(`  review_queue      : ~${totalPending}`);
  console.log(`  db_delta          : +${totalDbDelta} nuevas en BD (neto sesion)`);
  console.log(`  Pendientes humanos: /admin/pending-review`);
  console.log(`${'='.repeat(50)}\n`);
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
