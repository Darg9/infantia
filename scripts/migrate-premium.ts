import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE providers ADD COLUMN IF NOT EXISTS "isPremium" BOOLEAN NOT NULL DEFAULT false'
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE providers ADD COLUMN IF NOT EXISTS "premiumSince" TIMESTAMP(3)'
  );
  const check = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'providers'
    AND column_name IN ('isPremium', 'premiumSince')
    ORDER BY column_name
  `;
  console.log('✅ Columnas en BD:', check.map((c) => c.column_name).join(', '));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
