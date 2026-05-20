// =============================================================================
// probe-time-attrs.ts — Detecta qué fuentes tienen <time datetime> en HTML
//
// Propósito:
//   Identificar fuentes con actividades sin fecha (startDate IS NULL) que
//   PODRÍAN resolverse con zero-quota usando extractTimeDates(), antes de
//   consumir cuota Gemini innecesariamente.
//
// Flujo:
//   1. Consulta BD: fuentes ACTIVE con actividades sin startDate
//   2. Por cada fuente: toma hasta --sample URLs de actividades sin fecha
//   3. Fetch HTML → extractTimeDates()
//   4. Reporta: ¿tiene el patrón? ¿cuántas fechas? ¿muestras?
//
// Interpretación:
//   ✅ timeTags > 0  → candidata para --zero-quota (zero cuota Gemini)
//   ❌ timeTags = 0  → necesita Gemini, Playwright u otro enfoque
//   ⚠️  HTTP error   → fuente caída o URL expirada
//
// Uso:
//   npx tsx scripts/probe-time-attrs.ts
//   npx tsx scripts/probe-time-attrs.ts --sample=5
//   npx tsx scripts/probe-time-attrs.ts --source=planetario
//   npx tsx scripts/probe-time-attrs.ts --min-missing=3
// =============================================================================

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { CheerioExtractor } from '../src/modules/scraping/extractors/cheerio.extractor';

// ── Args ──────────────────────────────────────────────────────────────────────

const args         = process.argv.slice(2);
const sampleSize   = parseInt(args.find(a => a.startsWith('--sample='))?.split('=')[1] ?? '3', 10);
const sourceFilter = args.find(a => a.startsWith('--source='))?.split('=')[1]?.trim();
const minMissing   = parseInt(args.find(a => a.startsWith('--min-missing='))?.split('=')[1] ?? '1', 10);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Usa CheerioExtractor.extract() para reutilizar:
 *   - dispatcher TLS relajado (planetariodebogota.gov.co, jbb.gov.co, etc.)
 *   - User-Agent y headers correctos
 * Devuelve el HTML crudo (sin procesar) para pasarlo a extractTimeDates().
 */
async function fetchHtml(url: string): Promise<{ html: string; ok: boolean; status: number }> {
  const extractor = new CheerioExtractor();
  const result = await extractor.extract(url);
  if (result.status === 'FAILED') {
    return { html: '', ok: false, status: 0 };
  }
  // result.html es el HTML crudo antes del limpiado — lo necesitamos para extractTimeDates
  return { html: result.html ?? '', ok: true, status: 200 };
}

function verdict(hitCount: number, probed: number): string {
  if (probed === 0)        return '⏭️  sin URLs';
  const pct = Math.round((hitCount / probed) * 100);
  if (hitCount === 0)      return '❌  sin <time datetime>';
  if (pct >= 66)           return '✅  candidata zero-quota';
  return `⚠️  parcial (${pct}% URLs con <time>)`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  console.log('\n🔍 Probe <time datetime> — detectando fuentes con extracción determinística\n');

  // 1. Fuentes con actividades ACTIVE sin startDate — usando Prisma ORM
  const allActive = await prisma.activity.findMany({
    where: {
      status:       'ACTIVE',
      sourceDomain: { not: null },
      sourceUrl:    { not: null },
    },
    select: { sourceDomain: true, startDate: true },
  });

  // Agrupar por dominio
  const byDomain = new Map<string, { missing: number; total: number }>();
  for (const act of allActive) {
    const d = act.sourceDomain!;
    const cur = byDomain.get(d) ?? { missing: 0, total: 0 };
    cur.total++;
    if (!act.startDate) cur.missing++;
    byDomain.set(d, cur);
  }

  // Ordenar por missing DESC y filtrar min-missing
  const rows = [...byDomain.entries()]
    .filter(([, v]) => v.missing >= minMissing)
    .sort(([, a], [, b]) => b.missing - a.missing)
    .map(([domain, v]) => ({ sourceDomain: domain, ...v }));

  if (rows.length === 0) {
    console.log('✅ No hay fuentes con actividades ACTIVE sin startDate (min-missing=' + minMissing + ')');
    await prisma.$disconnect();
    return;
  }

  // Filtrar por --source si se proporcionó
  const filtered = sourceFilter
    ? rows.filter(r => r.sourceDomain.includes(sourceFilter))
    : rows;

  if (filtered.length === 0) {
    console.log(`ℹ️  Ninguna fuente coincide con "--source=${sourceFilter}"`);
    await prisma.$disconnect();
    return;
  }

  console.log(`📋 ${filtered.length} fuente(s) con actividades sin fecha (min-missing=${minMissing}):\n`);

  const summary: Array<{
    domain:    string;
    missing:   number;
    probed:    number;
    hits:      number;
    avgTags:   number;
    samples:   string[];
    verdict:   string;
  }> = [];

  for (const row of filtered) {
    const domain  = row.sourceDomain;
    const missing = row.missing;
    const total   = row.total;

    console.log(`━━━ ${domain} — ${missing}/${total} sin fecha ━━━`);

    // Tomar muestra de URLs sin fecha
    const activities = await prisma.activity.findMany({
      where: {
        sourceDomain: domain,
        status:       'ACTIVE',
        startDate:    null,
        sourceUrl:    { not: null },
      },
      select: { sourceUrl: true, title: true },
      take:   sampleSize,
    });

    if (activities.length === 0) {
      console.log('  ⏭️  sin URLs disponibles\n');
      summary.push({ domain, missing, probed: 0, hits: 0, avgTags: 0, samples: [], verdict: verdict(0, 0) });
      continue;
    }

    let hits   = 0;
    let sumTags = 0;
    const sampleDates: string[] = [];

    for (const act of activities) {
      const url = act.sourceUrl!;
      process.stdout.write(`  → ${url.slice(0, 70)}`);

      const { html, ok, status } = await fetchHtml(url);

      if (!ok) {
        console.log(` … ⚠️  fetch error (TLS / timeout / 4xx)`);
        continue;
      }

      const timeDates = CheerioExtractor.extractTimeDates(html);
      const tagCount  = timeDates.length;

      if (tagCount > 0) {
        hits++;
        sumTags += tagCount;
        const sample = timeDates[0].datetime;
        sampleDates.push(sample);
        console.log(` … ✅ ${tagCount} <time> → ${sample}`);
      } else {
        console.log(` … ❌ 0 <time datetime>`);
      }
    }

    const probed  = activities.length;
    const avgTags = hits > 0 ? Math.round(sumTags / hits) : 0;
    const v       = verdict(hits, probed);

    console.log(`\n  ${v}  |  probed=${probed}  hits=${hits}  avg-tags/url=${avgTags}`);
    if (sampleDates.length > 0) {
      console.log(`  muestra fechas: ${sampleDates.slice(0, 3).join(' | ')}`);
    }
    console.log('');

    summary.push({ domain, missing, probed, hits, avgTags, samples: sampleDates, verdict: v });
  }

  await prisma.$disconnect();

  // ── Resumen final ────────────────────────────────────────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Resumen — candidatas para zero-quota');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const candidates = summary.filter(s => s.hits > 0);
  const noHits     = summary.filter(s => s.hits === 0 && s.probed > 0);
  const noUrls     = summary.filter(s => s.probed === 0);

  if (candidates.length > 0) {
    console.log('✅ Candidatas para --zero-quota (tienen <time datetime>):');
    for (const c of candidates) {
      const cmd = `npx tsx scripts/force-reparse-source.ts --source=${c.domain.split('.')[0]} --only-missing-dates --zero-quota`;
      console.log(`   ${c.domain.padEnd(38)} missing=${c.missing}  hits=${c.hits}/${c.probed}  avg-tags=${c.avgTags}`);
      console.log(`   └─ ${cmd}`);
    }
    console.log('');
  }

  if (noHits.length > 0) {
    console.log('❌ Sin <time datetime> — requieren otra estrategia:');
    for (const c of noHits) {
      console.log(`   ${c.domain.padEnd(38)} missing=${c.missing}  → Gemini / Playwright / API`);
    }
    console.log('');
  }

  if (noUrls.length > 0) {
    console.log('⏭️  Sin URLs disponibles para probar:');
    for (const c of noUrls) {
      console.log(`   ${c.domain}`);
    }
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(err => {
  console.error('❌ Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
