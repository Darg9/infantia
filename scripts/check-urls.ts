import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // Ver URLs únicas de proveedores y sus sourceUrls
  const providers = await prisma.provider.findMany({
    select: {
      name: true,
      website: true,
      _count: { select: { activities: true } },
    },
    orderBy: { name: 'asc' },
  });
  console.log('\nPROVEEDORES:');
  for (const p of providers) {
    console.log(`  ${p.name} | website: ${p.website} | actividades: ${p._count.activities}`);
  }

  // Muestra 5 sourceUrls de actividades de BibloRed (por proveedor)
  const bibliored = await prisma.provider.findFirst({ where: { name: { contains: 'biblo' } } });
  if (bibliored) {
    const acts = await prisma.activity.findMany({
      where: { providerId: bibliored.id },
      select: { title: true, sourceUrl: true, sourceConfidence: true, pricePeriod: true },
      take: 5,
      orderBy: { createdAt: 'asc' },
    });
    console.log(`\nMUESTRA BIBLORED (primeras 5):`);
    for (const a of acts) {
      console.log(`  ${a.title.substring(0, 60)}`);
      console.log(`    URL: ${a.sourceUrl}`);
      console.log(`    Conf: ${a.sourceConfidence} | Precio: ${a.pricePeriod}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
