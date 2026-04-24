import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const updated = await prisma.scrapingSource.update({
    where: { id: 'f628a61a-fbf7-4c77-b868-73573e5b4dd1' },
    data: {
      url: 'https://fce.com.co/programacion-cultural/',
      name: 'FCE — Programación Cultural',
      lastRunStatus: null,
      lastRunAt: null,
      lastRunItems: null,
    },
    select: { id: true, name: true, url: true, isActive: true },
  })
  console.log('✅ FCE source actualizado:')
  console.log(`  ID   : ${updated.id}`)
  console.log(`  Nombre: ${updated.name}`)
  console.log(`  URL  : ${updated.url}`)
  console.log(`  Activa: ${updated.isActive}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
