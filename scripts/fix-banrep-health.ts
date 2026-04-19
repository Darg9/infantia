import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Banrep tiene score 0.00 — resetear a 0.50 (neutral) para que vuelva a ser visible
  const updated = await prisma.sourceHealth.updateMany({
    where: { source: 'banrepcultural.org', score: { lte: 0.1 } },
    data: { score: 0.50 },
  });
  console.log(`Banrep score actualizado: ${updated.count} registro(s)`);

  // Verificar resultado
  const health = await prisma.sourceHealth.findMany({ orderBy: { score: 'asc' } });
  console.log('\nSource Health actualizado:');
  for (const h of health) {
    const flag = h.score < 0.3 ? ' ⚠️ OCULTO' : ' ✅';
    console.log(`  ${h.source}: ${h.score.toFixed(2)}${flag}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
