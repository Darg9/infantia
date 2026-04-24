import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Buscar todos los logs RUNNING con más de 1 hora sin finish
  const stale = await prisma.scrapingLog.findMany({
    where: {
      status: 'RUNNING',
      finishedAt: null,
      startedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) }, // >1h
    },
    include: { source: { select: { name: true, url: true } } },
  })

  if (stale.length === 0) {
    console.log('✅ No hay logs RUNNING colgados')
    await prisma.$disconnect()
    return
  }

  console.log(`\nEncontrados ${stale.length} logs RUNNING colgados:\n`)
  for (const l of stale) {
    const colgadoMin = Math.round((Date.now() - l.startedAt.getTime()) / 60000)
    console.log(`  [${l.id.slice(0, 8)}] ${l.source.name} — colgado ${colgadoMin} min`)
  }

  // Marcarlos como FAILED
  const ids = stale.map(l => l.id)
  const result = await prisma.scrapingLog.updateMany({
    where: { id: { in: ids } },
    data: {
      status: 'FAILED',
      finishedAt: new Date(),
      errorMessage: 'Marcado FAILED automáticamente — proceso terminó sin actualizar el log (stale RUNNING)',
    },
  })

  console.log(`\n✅ Actualizados ${result.count} logs → FAILED`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
