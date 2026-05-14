// =============================================================================
// source-health.ts — Dashboard de salud operativa del catálogo por fuente
//
// Combina en una sola vista las 3 señales críticas post-DATE_FILTER:
//   1. Coverage drift   → ACTIVE + delta últimos 7 días
//   2. Duplicate growth → % dedupe en run_metrics acumulado
//   3. Temporal quality → DateCov (% con startDate) + V2% (extractionMetadata temporal)
//   4. Parser mix       → Gemini / Cheerio / pre-V2 por fuente
//
// Uso:
//   npx tsx scripts/source-health.ts [--min-active=N] [--all]
//
// Flags:
//   --min-active=N  Solo mostrar fuentes con ≥ N actividades ACTIVE (default: 1)
//   --all           Incluir todas las fuentes (incluidas con 0 ACTIVE)
//
// Interpretación de señales:
//   DateCov < 40%    → riesgo: DATE_FILTER no puede filtrar esta fuente
//   V2% = 0%         → deuda pre-V2: sin metadata temporal, sin métricas
//   Cheerio alto     → fallback excesivo (Gemini quota o bloqueado)
//   dedupe% alto     → duplicación creciente (mismo contenido llegando varias veces)
//   +7d = 0          → fuente puede estar muerta o sin rotación de eventos
// =============================================================================

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const MIN_ACTIVE = (() => {
  const flag = process.argv.find(a => a.startsWith('--min-active='));
  return flag ? parseInt(flag.split('=')[1] ?? '1', 10) : 1;
})();
const SHOW_ALL = process.argv.includes('--all');

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos
// ─────────────────────────────────────────────────────────────────────────────
type ExtractionMeta = {
  temporal?: { status?: string };
};

type ActivityRow = {
  sourceDomain: string | null;
  startDate: Date | null;
  extractionMetadata: unknown;
  createdAt: Date;
};

type RunMetricRow = {
  source_id: string;
  urls_scraped: number;
  gemini_ok: number;
  fallback_count: number;
  activities_saved: number;
};

type SourceRow = {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function pct(num: number, den: number): string {
  if (den === 0) return '— ';
  return `${Math.round((num / den) * 100)}%`;
}

function pad(s: string | number, n: number): string {
  return String(s).padEnd(n);
}

function parserMethod(meta: unknown): 'Gemini' | 'Cheerio' | 'pre-V2' {
  if (!meta || typeof meta !== 'object') return 'pre-V2';
  const m = meta as ExtractionMeta;
  if (!m.temporal) return 'pre-V2';
  if (m.temporal.status === 'degraded') return 'Cheerio';
  if (m.temporal.status === 'resolved' || m.temporal.status === 'missing') return 'Gemini';
  return 'pre-V2';
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // ── 1. Obtener todas las fuentes web/instagram configuradas ──────────────
  const sources = await prisma.scrapingSource.findMany({
    select: { id: true, name: true, url: true, isActive: true },
    orderBy: { name: 'asc' },
  }) as SourceRow[];

  // ── 2. Obtener actividades ACTIVE con metadata ─────────────────────────
  const activities = await prisma.activity.findMany({
    where: { status: 'ACTIVE' },
    select: {
      sourceDomain: true,
      startDate: true,
      extractionMetadata: true,
      createdAt: true,
    },
  }) as ActivityRow[];

  // ── 3. Obtener métricas de run (si existen) ───────────────────────────
  let runMetrics: RunMetricRow[] = [];
  try {
    runMetrics = await prisma.$queryRaw<RunMetricRow[]>`
      SELECT
        source_id::text,
        SUM(urls_scraped)::int      AS urls_scraped,
        SUM(gemini_ok)::int         AS gemini_ok,
        SUM(fallback_count)::int    AS fallback_count,
        SUM(activities_saved)::int  AS activities_saved
      FROM source_run_metrics
      GROUP BY source_id
    `;
  } catch {
    // Tabla vacía o no existe todavía — es válido en el primer run
  }
  const metricsById = new Map(runMetrics.map(r => [r.source_id, r]));

  // ── 4. Agrupar actividades por sourceDomain ──────────────────────────
  type DomainStats = {
    total: number;
    last7d: number;
    withDate: number;
    v2: number;
    gemini: number;
    cheerio: number;
    preV2: number;
  };

  const byDomain = new Map<string, DomainStats>();

  for (const a of activities) {
    const domain = a.sourceDomain ?? 'unknown';
    const stats = byDomain.get(domain) ?? {
      total: 0, last7d: 0, withDate: 0, v2: 0, gemini: 0, cheerio: 0, preV2: 0,
    };
    stats.total += 1;
    if (a.createdAt >= sevenDaysAgo) stats.last7d += 1;
    if (a.startDate !== null) stats.withDate += 1;
    const method = parserMethod(a.extractionMetadata);
    if (method === 'Gemini') { stats.gemini += 1; stats.v2 += 1; }
    else if (method === 'Cheerio') { stats.cheerio += 1; stats.v2 += 1; }
    else { stats.preV2 += 1; }
    byDomain.set(domain, stats);
  }

  // ── 5. Renderizar tabla ─────────────────────────────────────────────
  console.log('\n' + '═'.repeat(110));
  console.log(' 🏥  HabitaPlan — Source Health Dashboard');
  console.log('═'.repeat(110));
  console.log(
    pad('Fuente', 28) +
    pad('ACTIVE', 7) +
    pad('+7d', 5) +
    pad('DateCov', 8) +
    pad('V2%', 5) +
    pad('Gemini', 8) +
    pad('Cheerio', 9) +
    pad('pre-V2', 8) +
    pad('Dedupe%', 8) +
    'Estado'
  );
  console.log('─'.repeat(110));

  // Fuentes configuradas con datos
  // Deduplicar por dominio: si hay múltiples fuentes con el mismo dominio (ej. varias
  // configs de banrepcultural o varias cuentas de instagram.com), consolidar en 1 fila.
  // Criterio: la fuente isActive=true gana; entre iguales, la de nombre más corto (canonical).
  const domainToSrc = new Map<string, SourceRow>();
  for (const src of sources) {
    const domain = domainFromUrl(src.url);
    const existing = domainToSrc.get(domain);
    if (!existing) {
      domainToSrc.set(domain, src);
    } else {
      // Preferir la que está activa; si empatan, preferir el nombre más corto
      const takeNew = src.isActive && !existing.isActive;
      if (takeNew) domainToSrc.set(domain, src);
    }
  }

  // Etiqueta canónica para dominios multi-cuenta (ej. instagram.com)
  const DOMAIN_LABEL: Record<string, string> = {
    'instagram.com': 'Instagram (cuentas IG)',
  };

  const processedDomains = new Set<string>();

  for (const [domain, src] of domainToSrc) {
    processedDomains.add(domain);

    // Exact match only (sin sufijos — endsWith causaba que planetariodebogota.gov.co
    // heredara estadísticas de bogota.gov.co por compartir el sufijo .gov.co)
    const stats = byDomain.get(domain);

    const total = stats?.total ?? 0;
    if (!SHOW_ALL && total < MIN_ACTIVE) continue;

    const last7d = stats?.last7d ?? 0;
    const withDate = stats?.withDate ?? 0;
    const v2 = stats?.v2 ?? 0;
    const gemini = stats?.gemini ?? 0;
    const cheerio = stats?.cheerio ?? 0;
    const preV2 = stats?.preV2 ?? 0;

    // Métricas de run: sumar todas las fuentes con este dominio
    const allSrcIds = sources.filter(s => domainFromUrl(s.url) === domain).map(s => s.id);
    const rmEntries = allSrcIds.flatMap(id => { const r = metricsById.get(id); return r ? [r] : []; });
    const dedupePct = rmEntries.length > 0
      ? pct(
          rmEntries.reduce((s, r) => s + Number(r.urls_scraped) - Number(r.activities_saved), 0),
          rmEntries.reduce((s, r) => s + Number(r.urls_scraped), 0)
        )
      : '—  ';

    // Label: usar alias canónico si existe, si no el nombre de la fuente
    const label = DOMAIN_LABEL[domain] ?? src.name;

    // Señales de alerta
    const allPaused = sources.filter(s => domainFromUrl(s.url) === domain).every(s => !s.isActive);
    const alerts: string[] = [];
    if (allPaused) alerts.push('⏸ PAUSADA');
    if (total > 0 && withDate / total < 0.4) alerts.push('⚠️ DateCov<40%');
    if (total > 0 && preV2 / total > 0.7) alerts.push('🔴 pre-V2>70%');
    if (total > 0 && cheerio / total > 0.5) alerts.push('🟡 Cheerio>50%');
    if (last7d === 0 && total > 5) alerts.push('💤 sin nuevos 7d');

    console.log(
      pad(label.slice(0, 27), 28) +
      pad(total, 7) +
      pad(last7d > 0 ? `+${last7d}` : '0', 5) +
      pad(pct(withDate, total), 8) +
      pad(pct(v2, total), 5) +
      pad(gemini > 0 ? `${gemini}G` : '—', 8) +
      pad(cheerio > 0 ? `${cheerio}Ch` : '—', 9) +
      pad(preV2 > 0 ? `${preV2}pV2` : '—', 8) +
      pad(dedupePct, 8) +
      (alerts.length > 0 ? alerts.join(' ') : '✅')
    );
  }

  // Dominios en BD sin fuente configurada (Instagram, scraping ad-hoc, etc.)
  const unconfigured = [...byDomain.entries()].filter(([d]) => !processedDomains.has(d));
  if (unconfigured.length > 0) {
    console.log('─'.repeat(110));
    console.log(' Sin fuente configurada (Instagram / scraping directo):');
    for (const [domain, stats] of unconfigured.sort((a, b) => b[1].total - a[1].total)) {
      if (!SHOW_ALL && stats.total < MIN_ACTIVE) continue;
      console.log(
        pad(domain.slice(0, 27), 28) +
        pad(stats.total, 7) +
        pad(stats.last7d > 0 ? `+${stats.last7d}` : '0', 5) +
        pad(pct(stats.withDate, stats.total), 8) +
        pad(pct(stats.v2, stats.total), 5) +
        pad(stats.gemini > 0 ? `${stats.gemini}G` : '—', 8) +
        pad(stats.cheerio > 0 ? `${stats.cheerio}Ch` : '—', 9) +
        pad(stats.preV2 > 0 ? `${stats.preV2}pV2` : '—', 8) +
        pad('—', 8) +
        (stats.withDate / stats.total < 0.4 ? '⚠️ DateCov<40%' : '✅')
      );
    }
  }

  // ── 6. Resumen ──────────────────────────────────────────────────────────
  const totalActive = activities.length;
  const totalWithDate = activities.filter(a => a.startDate !== null).length;
  const totalGemini  = activities.filter(a => parserMethod(a.extractionMetadata) === 'Gemini').length;
  const totalCheerio = activities.filter(a => parserMethod(a.extractionMetadata) === 'Cheerio').length;
  const totalPreV2   = activities.filter(a => parserMethod(a.extractionMetadata) === 'pre-V2').length;

  console.log('═'.repeat(110));
  console.log(`\n📊 RESUMEN GLOBAL (${totalActive} ACTIVE)`);
  console.log(`   DateCov:  ${pct(totalWithDate, totalActive)} (${totalWithDate}/${totalActive})`);
  console.log(`   Parser:   Gemini ${totalGemini} | Cheerio ${totalCheerio} | pre-V2 ${totalPreV2}`);
  console.log(`   V2%:      ${pct(totalGemini + totalCheerio, totalActive)}`);
  if (runMetrics.length > 0) {
    const totalScraped = runMetrics.reduce((s, r) => s + Number(r.urls_scraped), 0);
    const totalSaved   = runMetrics.reduce((s, r) => s + Number(r.activities_saved), 0);
    console.log(`   Dedupe:   ${pct(totalScraped - totalSaved, totalScraped)} global acumulado`);
  } else {
    console.log(`   Dedupe:   — (source_run_metrics vacía, próximo run la poblará)`);
  }
  console.log('');
}

main().catch(console.error).finally(() => prisma.$disconnect());
