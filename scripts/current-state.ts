import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const grouped = await prisma.activity.groupBy({
    by: ['sourceDomain', 'sourcePlatform'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });

  const sources = await prisma.scrapingSource.findMany({
    select: { name: true, url: true, platform: true, isActive: true }
  });

  console.log('\n══════════════════════════════════════════');
  console.log('ACTIVIDADES EN BD — por dominio');
  console.log('══════════════════════════════════════════');
  for (const g of grouped) {
    console.log(`  ${String(g._count.id).padStart(4)} | ${g.sourcePlatform?.padEnd(10)} | ${g.sourceDomain}`);
  }
  console.log(`\n  TOTAL: ${grouped.reduce((acc, g) => acc + g._count.id, 0)} actividades`);

  console.log('\n══════════════════════════════════════════');
  console.log('SCRAPINGSOURCES REGISTRADAS');
  console.log('══════════════════════════════════════════');
  for (const s of sources) {
    const status = s.isActive ? '✅' : '⏸';
    console.log(`  ${status} [${s.platform.padEnd(10)}] ${s.name}`);
    console.log(`       ${s.url}`);
  }
}

main().finally(() => prisma.$disconnect());
