// =============================================================================
// migrate-provider-claims.ts — Crea tabla provider_claims y enum ClaimStatus
// Uso: npx tsx scripts/migrate-provider-claims.ts
// =============================================================================

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔄 Creando enum ClaimStatus...');
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);

  console.log('🔄 Creando tabla provider_claims...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS provider_claims (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "providerId"  TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      "userId"      TEXT NOT NULL,
      "userEmail"   VARCHAR(255) NOT NULL,
      "userName"    VARCHAR(255),
      message       TEXT,
      status        "ClaimStatus" NOT NULL DEFAULT 'PENDING',
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_provider_claims_provider ON provider_claims("providerId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_provider_claims_status ON provider_claims(status)
  `);

  const check = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'provider_claims'
  `;
  console.log('✅ Tabla creada:', check.length > 0 ? 'provider_claims' : '❌ ERROR');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
