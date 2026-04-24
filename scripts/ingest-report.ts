import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // ── Run FAILED y RUNNING ────────────────────────────────────────────────
  const problematic = await prisma.scrapingLog.findMany({
    where: {
      status: { in: ['FAILED', 'RUNNING'] },
      startedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    },
    include: { source: { select: { name: true, platform: true, url: true } } },
    orderBy: { startedAt: 'desc' },
  })

  console.log('\n══ RUNS FALLIDOS / COLGADOS (últimas 48h) ══')
  for (const l of problematic) {
    const dur = l.finishedAt
      ? Math.round((l.finishedAt.getTime() - l.startedAt.getTime()) / 1000) + 's'
      : `sin finish (${Math.round((Date.now() - l.startedAt.getTime()) / 60000)} min colgado)`
    console.log(`\n[${l.status}] ${l.source.name}`)
    console.log(`  Platform : ${l.source.platform}`)
    console.log(`  URL      : ${l.source.url?.slice(0, 80)}`)
    console.log(`  Inicio   : ${l.startedAt.toISOString().slice(0, 16)}`)
    console.log(`  Duración : ${dur}`)
    console.log(`  found:${l.itemsFound} | new:${l.itemsNew} | dup:${l.itemsDuplicated}`)
    console.log(`  Error    : ${l.errorMessage ?? '(sin mensaje)'}`)
  }

  // ── Runs PARTIAL — ver cuáles tuvieron problemas parciales ─────────────
  const partials = await prisma.scrapingLog.findMany({
    where: {
      status: 'PARTIAL',
      startedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    },
    include: { source: { select: { name: true, platform: true } } },
    orderBy: { startedAt: 'desc' },
  })

  console.log('\n══ RUNS PARTIAL (últimas 48h) ══')
  for (const l of partials) {
    console.log(`\n[PARTIAL] ${l.source.name} (${l.source.platform})`)
    console.log(`  ${l.startedAt.toISOString().slice(0, 16)} | found:${l.itemsFound} new:${l.itemsNew}`)
    if (l.errorMessage) console.log(`  Motivo: ${l.errorMessage.slice(0, 200)}`)
    else console.log(`  (sin mensaje de error en el log)`)
  }

  // ── Todos los runs con sourceId para saber qué fuente es cada uno ───────
  console.log('\n══ DETALLE COMPLETO DE RUNS (últimas 48h) ══')
  const all = await prisma.scrapingLog.findMany({
    where: { startedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
    include: { source: { select: { name: true, platform: true } } },
    orderBy: { startedAt: 'asc' },
  })
  for (const l of all) {
    const dur = l.finishedAt
      ? Math.round((l.finishedAt.getTime() - l.startedAt.getTime()) / 1000) + 's'
      : '?'
    const icon = l.status === 'SUCCESS' ? '✅' : l.status === 'FAILED' ? '❌' : l.status === 'RUNNING' ? '🔄' : '⚠️'
    console.log(
      `${icon} ${l.startedAt.toISOString().slice(11, 16)} | ${l.source.platform.padEnd(10)} | ${l.source.name.slice(0, 30).padEnd(30)} | ${l.status.padEnd(8)} | f:${String(l.itemsFound).padStart(4)} n:${String(l.itemsNew).padStart(3)} | ${dur}`
    )
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
