import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
  )
  console.log('Tablas en BD:', tables.map(t => t.tablename).join(', '))
  await prisma.$disconnect()
}
main().catch(e => { console.error(e.message); process.exit(1) })
