import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const verticals = await prisma.vertical.findMany({ select: { id: true, slug: true, name: true } });
  console.log('Verticals:', JSON.stringify(verticals, null, 2));

  const sample = await (prisma as any).scrapingSource.findFirst({ select: { id: true, name: true, verticalId: true, cityId: true } });
  console.log('Sample source:', JSON.stringify(sample, null, 2));

  await prisma.$disconnect();
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
