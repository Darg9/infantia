import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Aplicando migración legal...')

  // User — versionado de consentimientos
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_version" VARCHAR(50)`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "privacy_accepted_at" TIMESTAMP(3)`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "privacy_version" VARCHAR(50)`)
  console.log('✅ User: campos legales agregados')

  // ContactRequest — crear tabla completa (nunca fue migrada)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "contact_requests" (
      "id"                  VARCHAR(255)  NOT NULL PRIMARY KEY,
      "created_at"          TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "name"                VARCHAR(255),
      "email"               VARCHAR(255)  NOT NULL,
      "category"            VARCHAR(50)   NOT NULL,
      "message"             TEXT          NOT NULL,
      "data_right_type"     VARCHAR(50),
      "status"              VARCHAR(50)   NOT NULL DEFAULT 'received',
      "status_changed_at"   TIMESTAMP(3),
      "resolved_at"         TIMESTAMP(3),
      "resolved_by_user_id" VARCHAR(255),
      "email_status"        VARCHAR(50)   NOT NULL DEFAULT 'pending',
      "email_error"         TEXT,
      "ip"                  VARCHAR(50),
      "user_agent"          TEXT
    )
  `)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "contact_requests_email_idx"      ON "contact_requests" ("email")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "contact_requests_category_idx"   ON "contact_requests" ("category")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "contact_requests_created_at_idx" ON "contact_requests" ("created_at")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "contact_requests_status_idx"     ON "contact_requests" ("status")`)
  console.log('✅ ContactRequest: tabla creada con índices')

  // Registrar en _prisma_migrations para que prisma reconozca el estado
  await prisma.$executeRawUnsafe(`
    INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
    VALUES (
      gen_random_uuid()::text,
      'manual',
      NOW(),
      '20260424000000_add_legal_consent_versioning_and_pqrs_tracking',
      NULL, NULL, NOW(), 1
    )
    ON CONFLICT DO NOTHING
  `)
  console.log('✅ Migración registrada en _prisma_migrations')

  await prisma.$disconnect()
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
