import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const URLS = [
  'https://bogota.gov.co/que-hacer/cultura/planes-bogota-concierto-enrique-bunbury-bogota-octubre-29-de-2026',
  'https://www.idartes.gov.co/es/agenda/concierto/gustavo-santaolalla-llega-bogota-con-el-ronroco-tour',
  'https://www.idartes.gov.co/es/agenda/encuentro/6402-narrativas-espaciales-de-la-memoria-del-dato-al-memorial-digital',
];

async function main() {
  console.log('=== SCRAPING CACHE ===');
  for (const url of URLS) {
    const hit = await prisma.scrapingCache.findUnique({ where: { url } });
    const label = url.replace('https://', '').slice(0, 75);
    if (hit) {
      console.log(`[CACHED] ${label}`);
      console.log(`  title: ${hit.title?.slice(0, 60)}`);
      console.log(`  scrapedAt: ${hit.scrapedAt?.toISOString().slice(0, 10)}`);
    } else {
      console.log(`[MISS]   ${label}`);
    }
  }

  console.log('\n=== ACTIVITIES TABLE ===');
  const acts = await prisma.activity.findMany({
    where: {
      OR: [
        { title: { contains: 'Bunbury',     mode: 'insensitive' } },
        { title: { contains: 'Santaolalla', mode: 'insensitive' } },
        { title: { contains: 'Narrativas',  mode: 'insensitive' } },
        { sourceUrl: { in: URLS } },
      ],
    },
    select: {
      title:             true,
      status:            true,
      sourceUrl:         true,
      extractionMetadata: true,
      createdAt:         true,
    },
  });

  if (acts.length === 0) {
    console.log('  → 0 actividades encontradas — nunca llegaron a la BD');
  }
  for (const a of acts) {
    const meta = a.extractionMetadata as Record<string, unknown> | null;
    const temporal = meta?.['temporal'] as Record<string, unknown> | undefined;
    console.log(`\n  ${a.status.padEnd(14)} | ${a.title?.slice(0, 55)}`);
    console.log(`  parser: ${temporal?.['status'] ?? 'pre-V2'} | created: ${a.createdAt.toISOString().slice(0, 10)}`);
    console.log(`  url: ${a.sourceUrl?.slice(0, 70)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
