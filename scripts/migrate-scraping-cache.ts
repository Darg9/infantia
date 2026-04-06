import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Creating scraping_cache table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS scraping_cache (
      url        TEXT PRIMARY KEY,
      title      VARCHAR(500) NOT NULL DEFAULT '',
      source     VARCHAR(100) NOT NULL DEFAULT 'unknown',
      "scrapedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS scraping_cache_source_idx ON scraping_cache(source);
    CREATE INDEX IF NOT EXISTS scraping_cache_scraped_at_idx ON scraping_cache("scrapedAt");
  `);
  console.log('✅ scraping_cache table created');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
