import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Verificar columnas en tabla users
  const userCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('terms_version','privacy_version','privacy_accepted_at') ORDER BY column_name`
  )
  console.log('User legal cols in DB:', userCols.map(c => c.column_name))

  // Verificar si contact_requests existe
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%contact%'`
  )
  console.log('Contact tables found:', tables.map(t => t.tablename))

  await prisma.$disconnect()
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
