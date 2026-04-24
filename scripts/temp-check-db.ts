import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const sources = await prisma.scrapingSource.findMany({
    where: { name: { in: ['jbb.gov.co', 'bibliotecapiloto.gov.co', '@centrodeljapon', '@distritojovenbta', 'parqueexplora.org'] } },
    select: { name: true, isActive: true, notes: true, lastRunAt: true },
    orderBy: { updatedAt: 'desc' }
  });
  console.table(sources.map(s => ({
    name: s.name,
    active: s.isActive,
    notes: s.notes ? s.notes.substring(0, 50) : null,
    lastRunAt: s.lastRunAt ? s.lastRunAt.toISOString() : 'never'
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
