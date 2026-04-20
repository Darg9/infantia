import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const activities = await prisma.activity.groupBy({
    by: ['sourceDomain'],
    where: { status: 'ACTIVE' },
    _count: { _all: true },
    orderBy: { _count: { sourceDomain: 'desc' } }
  });

  console.log("=== Fuentes Activas (Status: ACTIVE) ===");
  for (const group of activities) {
     const domain = group.sourceDomain || 'N/A';
     const count = group._count._all;
     
     // Conseguir una URL de ejemplo
     const sample = await prisma.activity.findFirst({
        where: { status: 'ACTIVE', sourceDomain: group.sourceDomain },
        select: { sourceUrl: true }
     });

     console.log(`- Dominio: ${domain} (${count} actividades)`);
     console.log(`  Ejemplo: ${sample?.sourceUrl || 'N/A'}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
