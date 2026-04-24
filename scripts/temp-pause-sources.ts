import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const sourcesToPause = ['jbb.gov.co', '@centrodeljapon'];
  
  const result = await prisma.scrapingSource.updateMany({
    where: { name: { in: sourcesToPause } },
    data: {
      isActive: false,
      notes: '[PAUSADA 2026-04-24] Motivo: zero_yield_apr_2026'
    }
  });
  
  console.log(`Pausadas ${result.count} fuentes: ${sourcesToPause.join(', ')}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
