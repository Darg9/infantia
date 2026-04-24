import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) // 2 semanas

  const logs = await prisma.scrapingLog.groupBy({
    by: ['sourceId'],
    where: { startedAt: { gte: since }, status: { in: ['SUCCESS', 'PARTIAL'] } },
    _sum: { itemsNew: true, itemsFound: true },
    _count: { id: true },
    orderBy: { _sum: { itemsNew: 'desc' } },
  })

  const sources = await prisma.scrapingSource.findMany({
    select: { id: true, name: true, platform: true, scheduleCron: true, isActive: true },
  })
  const byId = Object.fromEntries(sources.map(s => [s.id, s]))

  console.log('\n══ ROI REAL por fuente (últimas 2 semanas) ══')
  console.log('Fuente'.padEnd(38) + 'Runs'.padEnd(6) + 'Found'.padEnd(8) + 'New'.padEnd(6) + 'scheduleCron')
  console.log('─'.repeat(80))

  for (const l of logs) {
    const s = byId[l.sourceId]
    if (!s) continue
    const name = s.name.slice(0, 37).padEnd(38)
    const runs = String(l._count.id).padEnd(6)
    const found = String(l._sum.itemsFound ?? 0).padEnd(8)
    const newItems = String(l._sum.itemsNew ?? 0).padEnd(6)
    const cron = s.scheduleCron ?? 'N/A'
    console.log(name + runs + found + newItems + cron)
  }

  // Fuentes activas sin run exitoso en 2 semanas
  const active = sources.filter(s => s.isActive)
  const withRuns = new Set(logs.map(l => l.sourceId))
  const dormant = active.filter(s => !withRuns.has(s.id))

  if (dormant.length > 0) {
    console.log('\n══ Activas sin run exitoso (2 semanas) ══')
    for (const s of dormant) {
      console.log(`  ${s.name} (${s.platform})`)
    }
  }

  // Total activas
  console.log(`\n══ Resumen ══`)
  console.log(`  Fuentes activas totales : ${active.length}`)
  console.log(`  Con runs en 2 semanas   : ${logs.length}`)
  console.log(`  Dormidas (sin runs)     : ${dormant.length}`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
