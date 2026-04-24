import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const cinemateca = await prisma.activity.findMany({
    where: { sourceUrl: { contains: 'cinematecadebogota' } },
    select: { id: true, title: true, sourceUrl: true, startDate: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  const bogota = await prisma.activity.findMany({
    where: { 
      OR: [
        { sourceUrl: { contains: 'bogota.gov.co' } },
        { sourceUrl: { contains: 'culturarecreacionydeporte' } }
      ]
    },
    select: { id: true, title: true, sourceUrl: true, startDate: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  const fce = await prisma.activity.findMany({
    where: { sourceUrl: { contains: 'fce.com.co' } },
    select: { id: true, title: true, sourceUrl: true, startDate: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  console.log('\n--- CINEMATECA (Últimas 5 insertadas) ---');
  console.table(cinemateca);

  console.log('\n--- BOGOTÁ / CULTURA (Últimas 5 insertadas) ---');
  console.table(bogota);

  console.log('\n--- FCE (Últimas 5 insertadas) ---');
  console.table(fce);
}

main().catch(console.error).finally(() => prisma.$disconnect());
