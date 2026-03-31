import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sponsors (
      id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name           VARCHAR(255) NOT NULL,
      tagline        VARCHAR(500) NOT NULL,
      "logoUrl"      TEXT,
      url            TEXT NOT NULL,
      "isActive"     BOOLEAN NOT NULL DEFAULT false,
      "campaignStart" TIMESTAMP(3),
      "campaignEnd"   TIMESTAMP(3),
      "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT NOW(),
      "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT NOW()
    )
  `);
  console.log('✅ Tabla sponsors creada (o ya existía)');
  await prisma.$disconnect();
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
