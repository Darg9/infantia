// =============================================================================
// seed-idartes-fuga.ts
//
// Registra IDartes y FUGA — Filarmónica de Bogotá como ScrapingSource en BD.
// Idempotente: usa upsert por name.
//
// Ejecutar:
//   npx tsx scripts/seed-idartes-fuga.ts
// =============================================================================

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const BOGOTA_CITY_ID   = 'b1b8e3d0-8c73-4a5c-ac48-286858dc0d99';
const KIDS_VERTICAL_ID = '7f8f366d-9877-494f-a192-d49097d321a0';

const SOURCES = [
  {
    name: 'Idartes',
    url: 'https://www.idartes.gov.co/es/agenda',
    platform: 'WEBSITE' as const,
    scraperType: 'cheerio',
    city:     { connect: { id: BOGOTA_CITY_ID } },
    vertical: { connect: { id: KIDS_VERTICAL_ID } },
    scheduleCron: '0 6 * * *',
    isActive: true,
  },
  {
    name: 'FUGA — Filarmónica de Bogotá',
    url: 'https://fuga.gov.co/agenda',
    platform: 'WEBSITE' as const,
    scraperType: 'cheerio',
    city:     { connect: { id: BOGOTA_CITY_ID } },
    vertical: { connect: { id: KIDS_VERTICAL_ID } },
    scheduleCron: '0 6 * * *',
    isActive: true,
  },
];

async function main() {
  for (const s of SOURCES) {
    const existing = await (prisma as any).scrapingSource.findFirst({ where: { name: s.name } });
    if (existing) {
      await (prisma as any).scrapingSource.update({
        where: { id: existing.id },
        data: { url: s.url, isActive: s.isActive },
      });
      console.log(`♻️  ${s.name} ya existe (actualizado) → id: ${existing.id}`);
    } else {
      const created = await (prisma as any).scrapingSource.create({ data: s });
      console.log(`✅ ${created.name} creado → id: ${created.id}`);
    }
  }
  await prisma.$disconnect();
  console.log('\nSeed completado.');
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
