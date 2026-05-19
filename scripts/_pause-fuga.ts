import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

void (async () => {
  const fuga = await prisma.scrapingSource.findFirst({ where: { url: { contains: 'fuga.gov.co' } } });
  if (!fuga) { console.log('FUGA no encontrada en DB'); return; }
  await prisma.scrapingSource.update({
    where: { id: fuga.id },
    data: {
      isActive: false,
      notes: 'PAUSADA S75 — 0 ACTIVE en toda su historia. Agenda de convocatorias/becas institucionales, no eventos de consumo público.',
    },
  });
  console.log('✅ FUGA pausada:', fuga.name, '—', fuga.id);
})().catch(err => console.error('ERROR:', err.message)).finally(async () => {
  await prisma.$disconnect();
  process.exit(0);
});
