// =============================================================================
// temporal-metrics.ts — Métricas de resolución temporal por fuente
// =============================================================================
//
// Muestra para cada fuente (sourceDomain):
//   - total actividades ACTIVE
//   - con fecha (startDate IS NOT NULL)
//   - tasa de resolución %
//   - gap real (dateMentionDetected = true pero sin startDate) — solo V2
//
// Uso:
//   npx tsx scripts/temporal-metrics.ts
//   npx tsx scripts/temporal-metrics.ts --min-activities=5
//
// =============================================================================

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const MIN_ACTIVITIES = parseInt(
  process.argv.find(a => a.startsWith('--min-activities='))?.split('=')[1] ?? '1',
  10,
);

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface SourceRow {
  domain: string;
  total: number;
  withDate: number;
  resolutionPct: number;
  v2Resolved: number;
  v2Degraded: number;
  v2Missing: number;
  dateSourceExplicit: number;
  dateSourceRelative: number;
  dateSourceInferred: number;
  mentionNotExtracted: number; // gap real: tenía fecha en texto pero no se estructuró
}

// ── Query ─────────────────────────────────────────────────────────────────────

async function getMetrics(): Promise<SourceRow[]> {
  // Query principal: agrupar por sourceDomain usando JSON de extractionMetadata
  const rows = await prisma.$queryRaw<Array<{
    domain: string;
    total: bigint;
    with_date: bigint;
    v2_resolved: bigint;
    v2_degraded: bigint;
    v2_missing: bigint;
    date_source_explicit: bigint;
    date_source_relative: bigint;
    date_source_inferred: bigint;
    mention_not_extracted: bigint;
  }>>`
    SELECT
      COALESCE(source_domain, 'unknown')                                          AS domain,
      COUNT(*)                                                                    AS total,
      COUNT(CASE WHEN "startDate" IS NOT NULL THEN 1 END)                         AS with_date,
      -- Métricas V2 (extraction_metadata.temporal presente desde commit 3583068)
      COUNT(CASE WHEN extraction_metadata->'temporal'->>'status' = 'resolved'   THEN 1 END) AS v2_resolved,
      COUNT(CASE WHEN extraction_metadata->'temporal'->>'status' = 'degraded'   THEN 1 END) AS v2_degraded,
      COUNT(CASE WHEN extraction_metadata->'temporal'->>'status' = 'missing'    THEN 1 END) AS v2_missing,
      -- dateSource (solo actividades con fecha extraída)
      COUNT(CASE WHEN extraction_metadata->'temporal'->>'dateSource' = 'explicit'  THEN 1 END) AS date_source_explicit,
      COUNT(CASE WHEN extraction_metadata->'temporal'->>'dateSource' = 'relative'  THEN 1 END) AS date_source_relative,
      COUNT(CASE WHEN extraction_metadata->'temporal'->>'dateSource' = 'inferred'  THEN 1 END) AS date_source_inferred,
      -- Gap real: tenía mención de fecha en texto pero no fue estructurada
      COUNT(CASE WHEN extraction_metadata->'temporal'->>'dateMentionDetected' = 'true'
                  AND extraction_metadata->'temporal'->>'status' = 'missing'      THEN 1 END) AS mention_not_extracted
    FROM activities
    WHERE status = 'ACTIVE'
    GROUP BY source_domain
    HAVING COUNT(*) >= ${MIN_ACTIVITIES}
    ORDER BY COUNT(*) DESC
  `;

  return rows.map(r => ({
    domain:              r.domain,
    total:               Number(r.total),
    withDate:            Number(r.with_date),
    resolutionPct:       Number(r.total) > 0
                           ? Math.round((Number(r.with_date) / Number(r.total)) * 100)
                           : 0,
    v2Resolved:          Number(r.v2_resolved),
    v2Degraded:          Number(r.v2_degraded),
    v2Missing:           Number(r.v2_missing),
    dateSourceExplicit:  Number(r.date_source_explicit),
    dateSourceRelative:  Number(r.date_source_relative),
    dateSourceInferred:  Number(r.date_source_inferred),
    mentionNotExtracted: Number(r.mention_not_extracted),
  }));
}

// ── Resumen global ─────────────────────────────────────────────────────────────

function globalSummary(rows: SourceRow[]) {
  const total       = rows.reduce((s, r) => s + r.total, 0);
  const withDate    = rows.reduce((s, r) => s + r.withDate, 0);
  const gap         = rows.reduce((s, r) => s + r.mentionNotExtracted, 0);
  const v2Resolved  = rows.reduce((s, r) => s + r.v2Resolved, 0);
  const v2Missing   = rows.reduce((s, r) => s + r.v2Missing, 0);
  const v2Degraded  = rows.reduce((s, r) => s + r.v2Degraded, 0);
  const pct         = total > 0 ? Math.round((withDate / total) * 100) : 0;

  console.log('\n📊 RESUMEN GLOBAL');
  console.log(`   Actividades ACTIVE:       ${total}`);
  console.log(`   Con startDate:            ${withDate} (${pct}%)`);
  console.log(`   Sin startDate:            ${total - withDate} (${100 - pct}%)`);
  console.log(`   Gap real (mención≠struct): ${gap}`);
  console.log(`   V2 resolved:              ${v2Resolved}`);
  console.log(`   V2 missing:               ${v2Missing}`);
  console.log(`   V2 degraded (Cheerio):    ${v2Degraded}`);
}

// ── Renderizado ───────────────────────────────────────────────────────────────

function renderTable(rows: SourceRow[]) {
  const COL = {
    domain: 32,
    total:   6,
    date:    8,
    pct:     6,
    v2r:     8,
    v2d:     8,
    v2m:     8,
    gap:     6,
    dsrc:   24,
  };

  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  const header = [
    pad('Dominio', COL.domain),
    pad('Total', COL.total),
    pad('c/Fecha', COL.date),
    pad('%', COL.pct),
    pad('V2-resol', COL.v2r),
    pad('V2-miss', COL.v2m),
    pad('V2-degr', COL.v2d),
    pad('Gap', COL.gap),
    pad('dateSource (exp/rel/inf)', COL.dsrc),
  ].join('  ');

  const sep = '-'.repeat(header.length);
  console.log('\n' + sep);
  console.log(header);
  console.log(sep);

  for (const r of rows) {
    const dsrc = r.v2Resolved > 0
      ? `${r.dateSourceExplicit}/${r.dateSourceRelative}/${r.dateSourceInferred}`
      : '-';
    const gapFlag = r.mentionNotExtracted > 0 ? `⚠️ ${r.mentionNotExtracted}` : '✓ 0';

    console.log([
      pad(r.domain.substring(0, COL.domain - 1), COL.domain),
      pad(r.total, COL.total),
      pad(r.withDate, COL.date),
      pad(`${r.resolutionPct}%`, COL.pct),
      pad(r.v2Resolved, COL.v2r),
      pad(r.v2Missing, COL.v2m),
      pad(r.v2Degraded, COL.v2d),
      pad(gapFlag, COL.gap),
      pad(dsrc, COL.dsrc),
    ].join('  '));
  }

  console.log(sep);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🕐 temporal-metrics.ts — ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })} COT`);
  console.log(`   Filtro: actividades ACTIVE con >= ${MIN_ACTIVITIES} registros por fuente\n`);

  const rows = await getMetrics();

  if (rows.length === 0) {
    console.log('Sin datos.');
    return;
  }

  renderTable(rows);
  globalSummary(rows);

  // Alertas de calidad
  const poorSources = rows.filter(r => r.resolutionPct < 30 && r.total >= 5);
  if (poorSources.length > 0) {
    console.log('\n⚠️  FUENTES CON COBERTURA TEMPORAL < 30%:');
    poorSources.forEach(r => console.log(`   ${r.domain} — ${r.resolutionPct}% (${r.total} actividades)`));
  }

  const gapSources = rows.filter(r => r.mentionNotExtracted >= 3);
  if (gapSources.length > 0) {
    console.log('\n🔍 FUENTES CON GAP REAL (fecha en texto, no estructurada):');
    gapSources.forEach(r =>
      console.log(`   ${r.domain} — ${r.mentionNotExtracted} actividades con mención sin estructura`)
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
