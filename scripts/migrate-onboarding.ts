// =============================================================================
// migrate-onboarding.ts — Agrega onboardingDone a users
// Uso: npx tsx scripts/migrate-onboarding.ts
// =============================================================================

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔄 Agregando columna onboardingDone a users...');
  await prisma.$executeRawUnsafe(
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS "onboardingDone" BOOLEAN NOT NULL DEFAULT false'
  );

  // Usuarios existentes ya completaron su perfil — marcarlos como done
  const { count } = await prisma.user.updateMany({
    where: { onboardingDone: false },
    data: { onboardingDone: true },
  });
  console.log(`✅ ${count} usuarios existentes marcados como onboardingDone=true`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
