// source-ranking.ts
// Genera ranking de fuentes de scraping en 3 niveles:
//   Nivel 1 (Producción): % actividades / posts analizados + confianza promedio
//   Nivel 2 (Volumen): actividades nuevas por semana
//   Nivel 3 (Alcance): seguidores (manual, desde ScrapingSource.notes o config)
//
// Uso: npx tsx scripts/source-ranking.ts [--weeks=4] [--platform=INSTAGRAM|WEBSITE]

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface SourceScore {
  name: string;
  platform: string;
  url: string;
  // Nivel 1 — Producción
  totalRuns: number;
  totalItemsFound: number;
  totalItemsNew: number;
  productionRate: number;   // itemsNew / itemsFound (0-1)
  // Nivel 2 — Volumen
  weeksActive: number;
  newPerWeek: number;       // itemsNew / weeksActive
  // Nivel 3 — Alcance
  followers: number | null; // desde config JSON o notes
  // Score final (0-100)
  score: number;
  tier: '🥇 A' | '🥈 B' | '🥉 C' | '❌ D';
}

function calcScore(s: SourceScore): number {
  // Pesos: producción 50%, volumen 30%, alcance 20%
  const prodScore   = Math.min(s.productionRate * 100, 100) * 0.5;
  const volScore    = Math.min((s.newPerWeek / 5) * 100, 100) * 0.3; // 5 nuevas/semana = 100%
  const reachScore  = s.followers ? Math.min((s.followers / 50000) * 100, 100) * 0.2 : 10; // 50K = 100%
  return Math.round(prodScore + volScore + reachScore);
}

function calcTier(score: number): SourceScore['tier'] {
  if (score >= 70) return '🥇 A';
  if (score >= 40) return '🥈 B';
  if (score >= 20) return '🥉 C';
  return '❌ D';
}

async function main() {
  const args = process.argv.slice(2);
  const weeksArg = args.find((a) => a.startsWith('--weeks='));
  const weeks = weeksArg ? parseInt(weeksArg.split('=')[1], 10) : 4;
  const platformArg = args.find((a) => a.startsWith('--platform='))?.split('=')[1]?.toUpperCase();

  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);

  console.log(`\n📊 RANKING DE FUENTES — últimas ${weeks} semanas\n`);

  const where: any = { isActive: true };
  if (platformArg) where.platform = platformArg;

  const sources = await prisma.scrapingSource.findMany({
    where,
    include: {
      logs: {
        where: { startedAt: { gte: since }, status: { in: ['SUCCESS', 'PARTIAL'] } },
        select: { itemsFound: true, itemsNew: true, startedAt: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const scores: SourceScore[] = sources.map((src) => {
    const logs = src.logs;
    const totalFound = logs.reduce((a, l) => a + (l.itemsFound ?? 0), 0);
    const totalNew   = logs.reduce((a, l) => a + (l.itemsNew ?? 0), 0);
    const prodRate   = totalFound > 0 ? totalNew / totalFound : 0;

    // Followers desde config JSON
    const config = (src.config as any) ?? {};
    const followers = config?.instagram?.followers ?? config?.followers ?? null;

    const score_obj: SourceScore = {
      name: src.name,
      platform: src.platform,
      url: src.url,
      totalRuns: logs.length,
      totalItemsFound: totalFound,
      totalItemsNew: totalNew,
      productionRate: prodRate,
      weeksActive: weeks,
      newPerWeek: totalNew / weeks,
      followers,
      score: 0,
      tier: '❌ D',
    };
    score_obj.score = calcScore(score_obj);
    score_obj.tier = calcTier(score_obj.score);
    return score_obj;
  });

  // Ordenar por score desc
  scores.sort((a, b) => b.score - a.score);

  // Imprimir tabla
  console.log('┌─────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ Tier  │ Fuente                         │ Runs │ Encontradas │ Nuevas │ Score    │');
  console.log('├─────────────────────────────────────────────────────────────────────────────────┤');

  for (const s of scores) {
    const name = s.name.padEnd(30).slice(0, 30);
    const runs = String(s.totalRuns).padStart(4);
    const found = String(s.totalItemsFound).padStart(11);
    const newA = String(s.totalItemsNew).padStart(6);
    const score = `${s.score}/100`.padStart(8);
    console.log(`│ ${s.tier} │ ${name} │ ${runs} │ ${found} │ ${newA} │ ${score} │`);
  }
  console.log('└─────────────────────────────────────────────────────────────────────────────────┘');

  // Desglose por tier
  const tiers = ['🥇 A', '🥈 B', '🥉 C', '❌ D'] as const;
  console.log('\n── Detalle por tier ──────────────────────────────────────────────');
  for (const tier of tiers) {
    const group = scores.filter((s) => s.tier === tier);
    if (group.length === 0) continue;
    console.log(`\n${tier} (${group.length} fuentes):`);
    for (const s of group) {
      const rate = (s.productionRate * 100).toFixed(0);
      const wpw = s.newPerWeek.toFixed(1);
      const followers = s.followers ? `${(s.followers/1000).toFixed(0)}K seg` : 'seg: ?';
      console.log(`   ${s.name}`);
      console.log(`     Tasa producción: ${rate}% | ${wpw} nuevas/sem | ${followers} | ${s.totalRuns} runs`);
    }
  }

  console.log('\n── Recomendaciones ───────────────────────────────────────────────');
  const tierA = scores.filter((s) => s.tier === '🥇 A');
  const tierD = scores.filter((s) => s.tier === '❌ D');
  if (tierA.length > 0) console.log(`✅ Priorizar: ${tierA.map((s) => s.name).join(', ')}`);
  if (tierD.length > 0) console.log(`⚠️  Revisar/pausar: ${tierD.map((s) => s.name).join(', ')}`);
  console.log('');

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
