import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const total = await prisma.scrapingCache.count({ where: { domain: 'biblored.gov.co' } });
  const reparse = await prisma.scrapingCache.count({ where: { domain: 'biblored.gov.co', needsReparse: true } });

  const oldest = await prisma.scrapingCache.findMany({
    where: { domain: 'biblored.gov.co', needsReparse: true },
    orderBy: { scrapedAt: 'asc' },
    take: 5,
    select: { url: true, scrapedAt: true }
  });

  const newest = await prisma.scrapingCache.findMany({
    where: { domain: 'biblored.gov.co', needsReparse: true },
    orderBy: { scrapedAt: 'desc' },
    take: 3,
    select: { url: true, scrapedAt: true }
  });

  console.log('=== BibloRed Reparse Queue ===');
  console.log('Total en cache:', total);
  console.log('needsReparse=true:', reparse);
  console.log('\nMás antiguas (¿por qué se atascaron?):');
  oldest.forEach(s => console.log(' ', s.scrapedAt?.toISOString().split('T')[0], s.url.substring(0, 80)));
  console.log('\nMás recientes:');
  newest.forEach(s => console.log(' ', s.scrapedAt?.toISOString().split('T')[0], s.url.substring(0, 80)));

  await prisma.$disconnect();
}
main().catch(console.error);
