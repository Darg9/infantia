// ingest-sources-v2.ts
// Ingesta Pipeline V2 — recall-first, fuentes institucionales protegidas.
// Interfaz idéntica a ingest-sources.ts. Pipeline V1 no es modificado.
//
// Uso:
//   npx tsx scripts/ingest-sources-v2.ts --list
//   npx tsx scripts/ingest-sources-v2.ts --source=biblored --save-db
//   npx tsx scripts/ingest-sources-v2.ts --channel=web --save-db
//   npx tsx scripts/ingest-sources-v2.ts --source=idartes,planetario --save-db --dry-run

import 'dotenv/config';
import { ScrapingPipeline } from '../src/modules/scraping/pipeline';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { quota } from '../src/lib/quota-tracker';

type Channel = 'web' | 'instagram' | 'tiktok' | 'facebook' | 'telegram';

const SOCIAL_CHANNELS: Channel[] = ['instagram', 'tiktok', 'facebook'];

interface Source {
  name:          string;
  channel:       Channel;
  url:           string;
  cityName?:     string;
  verticalSlug?: string;
  sitemapPatterns?: string[];
  maxPages?:     number; // límite paginación + presupuesto Gemini (K)
}

// ── Catálogo de fuentes (institucionales primero) ─────────────────────────────
// V2 usa las mismas fuentes que V1 — la diferencia está en el gate, no en las fuentes.
const ALL_SOURCES: Source[] = [
  // ── Bogotá Institucionales ─────────────────────────────────────────────────
  { name: 'BibloRed',          channel: 'web', url: 'https://www.biblored.gov.co/eventos',      cityName: 'Bogotá', maxPages: 50 },
  { name: 'Idartes',           channel: 'web', url: 'https://www.idartes.gov.co/es/agenda',    cityName: 'Bogotá', maxPages: 50 },
  { name: 'Planetario',        channel: 'web', url: 'https://planetariodebogota.gov.co',       cityName: 'Bogotá' },
  { name: 'Cinemateca',        channel: 'web', url: 'https://cinematecadebogota.gov.co',       cityName: 'Bogotá' },
  { name: 'Banrep Bogotá',     channel: 'web', url: 'https://www.banrepcultural.org/bogota',   cityName: 'Bogotá' },
  { name: 'FCE Bogotá',        channel: 'web', url: 'https://fce.com.co/programacion-cultural', cityName: 'Bogotá' },
  { name: 'JBB',               channel: 'web', url: 'https://jbb.gov.co',                     cityName: 'Bogotá' },
  { name: 'Sec. Cultura',      channel: 'web', url: 'https://culturarecreacionydeporte.gov.co', cityName: 'Bogotá' },
  { name: 'Alcaldía de Bogotá',channel: 'web', url: 'https://bogota.gov.co/que-hacer/agenda-cultural', cityName: 'Bogotá', maxPages: 50 },

  // ── Medellín Institucionales ───────────────────────────────────────────────
  { name: 'Parque Explora',    channel: 'web', url: 'https://parqueexplora.org',               cityName: 'Medellín' },

  // ── Instagram ─────────────────────────────────────────────────────────────
  { name: 'IG: quehaypahacerenbogota', channel: 'instagram', url: 'https://www.instagram.com/quehaypahacerenbogota', cityName: 'Bogotá' },
  { name: 'IG: quehacerenmedellin',    channel: 'instagram', url: 'https://www.instagram.com/quehacerenmedellin',   cityName: 'Medellín' },
];

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun    = args.includes('--dry-run');
const listMode  = args.includes('--list');
const saveDb    = args.includes('--save-db') && !dryRun;

const channelArg = args.find(a => a.startsWith('--channel='))?.replace('--channel=', '');
const sourceArg  = args.find(a => a.startsWith('--source='))?.replace('--source=', '');
const maxPagesArg = parseInt(args.find(a => a.startsWith('--max-pages='))?.replace('--max-pages=', '') ?? '10');

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
  console.log('\n📋 Fuentes disponibles — Pipeline V2\n');
  const byChannel = new Map<Channel, Source[]>();
  for (const s of ALL_SOURCES) {
    if (!byChannel.has(s.channel)) byChannel.set(s.channel, []);
    byChannel.get(s.channel)!.push(s);
  }
  for (const [ch, sources] of byChannel) {
    console.log(`\n${ch.toUpperCase()}`);
    for (const s of sources) console.log(`  • ${s.name} (${s.cityName ?? 'N/A'})`);
  }
  console.log();
  process.exit(0);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prismaLocal = new PrismaClient({ adapter });

  const selected = ALL_SOURCES.filter(matchesFilter);
  if (selected.length === 0) {
    console.error('❌ Ninguna fuente coincide con los filtros.');
    process.exit(1);
  }

  // Verificar cuota Gemini
  const remaining = await quota.getRemaining();
  console.log(`\n🤖 Pipeline V2 — ${selected.length} fuente(s) | Cuota Gemini: ${remaining} req restantes`);
  if (remaining <= 0) {
    console.error('❌ Cuota Gemini agotada. Espera el reset (08:00 UTC).');
    process.exit(1);
  }

  if (dryRun)  console.log('🔍 Modo DRY-RUN: descubriendo sin guardar');
  if (!saveDb) console.log('ℹ️  Sin --save-db: no se guarda en BD');

  console.log('🔁 Gate V2 activo: recall-first, institucionales → PENDING_REVIEW si score bajo\n');

  let totalNew = 0;
  let totalPending = 0;

  for (const source of selected) {
    console.log(`\n▶ ${source.name} (${source.channel}) — ${source.url}`);

    const pipeline = new ScrapingPipeline({
      saveToDb:    saveDb,
      cityName:    source.cityName ?? 'Bogotá',
      verticalSlug: source.verticalSlug ?? 'kids',
      useGateV2:   true,   // ← ÚNICA diferencia con V1
    });

    try {
      const sourceRecord = await prismaLocal.scrapingSource.findFirst({
        where: { url: source.url },
      });

      if (source.channel === 'instagram') {
        const result = await pipeline.runInstagramPipeline(source.url, {
          maxPosts: 20,
        });
        const saved = result.savedCount ?? 0;
        console.log(`  ✅ Instagram: ${saved} guardadas`);
        totalNew += saved;
      } else {
        const result = await pipeline.runBatchPipeline(source.url, {
          maxPages: source.maxPages ?? maxPagesArg,
          sitemapPatterns: source.sitemapPatterns,
        });
        // Estimar PENDING_REVIEW como actividades detectadas menos las guardadas directamente
        const detected = result.results?.filter(r => r.data?.isActivity === true).length ?? 0;
        const saved = result.savedCount ?? 0;
        const pending = Math.max(0, detected - saved);
        console.log(`  ✅ Web: ${saved} activas, ~${pending} pendientes de revisión`);
        totalNew     += saved;
        totalPending += pending;
      }
    } catch (err) {
      console.error(`  ❌ Error en ${source.name}:`, err instanceof Error ? err.message : err);
    } finally {
      await pipeline.disconnect();
    }
  }

  await prismaLocal.$disconnect();

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ V2 completado`);
  console.log(`   Publicadas directamente: ${totalNew}`);
  console.log(`   Pendientes de revisión:  revisa /admin/pending-review`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
