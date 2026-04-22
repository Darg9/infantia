import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const FIXES: { name: string; keywords: string[]; url: string }[] = [
  {
    name: 'BiblioRed',
    keywords: ['biblored'],
    url: 'https://www.biblored.gov.co/eventos',
  },
  {
    name: 'Idartes',
    keywords: ['idartes'],
    url: 'https://www.idartes.gov.co/es/agenda',
  },
  {
    name: 'Jardín Botánico',
    keywords: ['jbb', 'jardin botanic', 'jardín botánico'],
    url: 'https://jbb.gov.co/eventos/agenda-cultural-academica/',
  },
  {
    name: 'Planetario de Bogotá',
    keywords: ['planetario'],
    url: 'https://planetariodebogota.gov.co/programate',
  },
  {
    name: 'Alcaldía de Bogotá',
    keywords: ['bogota.gov.co', 'alcaldia', 'alcaldía'],
    url: 'https://bogota.gov.co/que-hacer/agenda-cultural',
  },
  {
    name: 'Cinemateca de Bogotá',
    keywords: ['cinemateca'],
    url: 'https://cinematecadebogota.gov.co/cine/11',
  },
];

async function main() {
  const sources = await prisma.scrapingSource.findMany({
    select: { id: true, name: true, url: true },
  });

  console.log(`\n🔍 Total fuentes en DB: ${sources.length}\n`);

  for (const fix of FIXES) {
    const match = sources.find((s) =>
      fix.keywords.some(
        (kw) =>
          s.name.toLowerCase().includes(kw) ||
          s.url.toLowerCase().includes(kw)
      )
    );

    if (!match) {
      console.log(`⚠️  ${fix.name}: No encontrada en DB`);
      continue;
    }

    if (match.url === fix.url) {
      console.log(`✅ ${fix.name}: URL ya correcta (${fix.url})`);
      continue;
    }

    await prisma.scrapingSource.update({
      where: { id: match.id },
      data: {
        url: fix.url,
        lastRunAt: null, // resetear para que el cron la priorice
      },
    });

    console.log(`✅ ${fix.name} [${match.id}]`);
    console.log(`   Antes: ${match.url}`);
    console.log(`   Ahora: ${fix.url}\n`);
  }

  console.log('\n🎯 Listo. Las fuentes corregidas correrán en el próximo ciclo del cron.');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
