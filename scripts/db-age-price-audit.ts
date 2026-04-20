import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { createLogger } from '../src/lib/logger';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const log = createLogger('db-audit');

async function main() {
  log.info('--- AUDITORÍA DE EDAD Y PRECIO POR TIPO DE PARSER (Confidence) ---');
  // Usamos sourceConfidence como proxy: 0.5 = fallback, >0.5 = Gemini
  const parserStats = await prisma.$queryRawUnsafe(`
    SELECT
      CASE WHEN "sourceConfidence" <= 0.5 THEN 'fallback' ELSE 'gemini' END as parser,
      COUNT(*) as total,
      COUNT("ageMin") as with_age,
      COUNT(price) as with_price
    FROM activities
    GROUP BY CASE WHEN "sourceConfidence" <= 0.5 THEN 'fallback' ELSE 'gemini' END
  `);
  console.table(parserStats);

  log.info('\\n--- AUDITORÍA DE EDAD Y PRECIO POR DOMINIO ---');
  const domainStats = await prisma.$queryRawUnsafe(`
    SELECT
      source_domain,
      COUNT(*) as total,
      COUNT("ageMin") as with_age,
      COUNT(price) as with_price
    FROM activities
    GROUP BY source_domain
    ORDER BY total DESC
    LIMIT 20
  `);
  console.table(domainStats);

  process.exit(0);
}

main().catch(console.error);
