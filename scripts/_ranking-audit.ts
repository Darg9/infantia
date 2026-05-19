// scripts/_ranking-audit.ts — Discovery Ranking v3 audit

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { rankCandidates } from '../src/modules/scraping/ranking';
import type { DiscoveredLink } from '../src/modules/scraping/types';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const EVENT_RE = /\b(taller|evento|feria|inscripci[oó]n|agenda|programaci[oó]n|funci[oó]n|concierto|exposici[oó]n|charla|conversatorio|festival|ballet|danza|teatro|cine|pel[ií]cula|muestra|proyecci[oó]n|[oó]pera|infantil)\b/i;
const URL_EVENT_RE = /(\/evento\/|\/agenda\/|\/eventos\/|\/programate\/|\/actividad\/|\/planes-|\/pelicula)/i;
const URL_DATE_RE = /\/\d{4}\/\d{2}(?:\/\d{2})?\/|\/\d{4}-\d{2}-\d{2}\//;

void (async () => {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  DISCOVERY RANKING — AUDITORÍA v3');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ── 1. Dominios en cache ──────────────────────────────────────────
  const cacheGroups = await prisma.$queryRaw<Array<{ source: string; cnt: bigint }>>`
    SELECT source, COUNT(*) AS cnt
    FROM scraping_cache
    GROUP BY source
    ORDER BY cnt DESC
    LIMIT 12
  `;

  console.log('🔬 SIMULACIÓN — scraping_cache por dominio (sample 300 más recientes):\n');
  console.log('Dominio'.padEnd(40), 'Cache'.padStart(6), 'Active'.padStart(7),
    'ZeroPct'.padStart(9), 'Avg'.padStart(6), '≥5'.padStart(5), '≤0'.padStart(5));
  console.log('─'.repeat(82));

  const domainDetails: Array<{
    domain: string;
    zeroScorePct: number;
    rankedPool: ReturnType<typeof rankCandidates>['rankedPool'];
  }> = [];

  for (const group of cacheGroups) {
    const domain = group.source;
    const totalInCache = Number(group.cnt);

    const urls = await prisma.scrapingCache.findMany({
      where: { source: domain },
      select: { url: true, title: true },
      take: 300,
      orderBy: { scrapedAt: 'desc' },
    });

    const links: DiscoveredLink[] = urls.map(u => ({
      url: u.url, title: u.title ?? '', snippet: '', anchorText: '',
    }));

    const { rankedPool, zeroScorePct } = rankCandidates(links, { maxPagesLimit: 30 });
    const avgScore = rankedPool.length ? rankedPool.reduce((s, r) => s + r.score, 0) / rankedPool.length : 0;
    const score5p = rankedPool.filter(r => r.score >= 5).length;
    const score0  = rankedPool.filter(r => r.score <= 0).length;

    const activeCount = await prisma.activity.count({
      where: { sourceDomain: domain, status: 'ACTIVE' },
    });

    domainDetails.push({ domain, zeroScorePct, rankedPool });

    const flag = zeroScorePct > 60 ? '🔴' : zeroScorePct > 40 ? '⚠️' : '✅';
    console.log(
      `${flag} ${domain}`.padEnd(42),
      String(totalInCache).padStart(6),
      String(activeCount).padStart(7),
      `${zeroScorePct}%`.padStart(9),
      avgScore.toFixed(1).padStart(6),
      String(score5p).padStart(5),
      String(score0).padStart(5),
    );
  }

  // ── 2. Ejemplos por dominio ───────────────────────────────────────
  console.log('\n\n📋 EJEMPLOS POR DOMINIO:\n');
  for (const { domain, zeroScorePct, rankedPool } of domainDetails.slice(0, 8)) {
    const top2  = rankedPool.filter(r => r.score >= 5).slice(0, 2);
    const zero2 = rankedPool.filter(r => r.score <= 0).slice(0, 2);
    console.log(`  ── ${domain}  (ZeroPct: ${zeroScorePct}%)`);
    for (const c of top2) {
      const sigs = Object.entries(c.signals).map(([k, v]) => `${k}:${v}`).join(' ');
      const path = c.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 68);
      console.log(`    ✅ [${c.score}] ${path}`);
      if (c.title) console.log(`        "${c.title.slice(0, 70)}"`);
      console.log(`        signals: ${sigs}`);
    }
    for (const c of zero2) {
      const path = c.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 68);
      console.log(`    ❌ [${c.score}] ${path}`);
    }
    console.log();
  }

  // ── 3. Señales en ACTIVE ──────────────────────────────────────────
  console.log('\n🏆 SEÑALES EN ACTIVIDADES ACTIVE:\n');

  const actives = await prisma.activity.findMany({
    where: { status: 'ACTIVE', sourceUrl: { not: null } },
    select: { sourceUrl: true, sourceDomain: true, title: true },
    take: 300,
  });

  let urlEventHit = 0, urlDateHit = 0, eventWordHit = 0, lowScore = 0;
  const total = actives.length;
  const lowExamples: string[] = [];

  for (const act of actives) {
    if (!act.sourceUrl) continue;
    if (URL_EVENT_RE.test(act.sourceUrl)) urlEventHit++;
    if (URL_DATE_RE.test(act.sourceUrl)) urlDateHit++;
    if (EVENT_RE.test(`${act.title ?? ''} ${act.sourceUrl}`)) eventWordHit++;

    const link: DiscoveredLink = { url: act.sourceUrl, title: act.title ?? '', snippet: '', anchorText: '' };
    const { rankedPool } = rankCandidates([link], { maxPagesLimit: 1 });
    if ((rankedPool[0]?.score ?? 0) <= 1) {
      lowScore++;
      if (lowExamples.length < 5)
        lowExamples.push(`    [${rankedPool[0]?.score ?? '?'}] ${act.sourceDomain} — ${act.sourceUrl.slice(-55)}`);
    }
  }

  console.log(`  Total ACTIVE con sourceUrl: ${total}`);
  console.log(`  URL_EVENT_RE (+2): ${urlEventHit}/${total} = ${((urlEventHit/total)*100).toFixed(1)}%`);
  console.log(`  URL_DATE_RE  (+2): ${urlDateHit}/${total} = ${((urlDateHit/total)*100).toFixed(1)}%`);
  console.log(`  EVENT_RE     (+3): ${eventWordHit}/${total} = ${((eventWordHit/total)*100).toFixed(1)}% (título+URL)`);
  console.log(`\n  Score ≤ 1 (deprioritizadas por ranker): ${lowScore}/${total} = ${((lowScore/total)*100).toFixed(1)}%`);
  lowExamples.forEach(l => console.log(l));

  console.log('\n══════════════════════════════════════════════════════════════\n');
})().catch(err => {
  console.error('\nERROR:', err.message ?? String(err));
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
  process.exit(0);
});
