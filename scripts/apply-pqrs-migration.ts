import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "contact_requests" ADD COLUMN IF NOT EXISTS "first_responded_at" TIMESTAMP(3)`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "contact_requests" ADD COLUMN IF NOT EXISTS "response_channel" VARCHAR(50)`
  )
  await prisma.$executeRawUnsafe(`
    INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
    VALUES (gen_random_uuid()::text, 'manual', NOW(), '20260424120000_add_pqrs_response_tracking', NULL, NULL, NOW(), 1)
    ON CONFLICT DO NOTHING
  `)
  console.log('✅ Campos first_responded_at + response_channel agregados a contact_requests')
  await prisma.$disconnect()
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
