// Limpia el caché de URLs de BibloRed /programate/* para forzar reprocesamiento
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.scrapingCache.deleteMany({
    where: { url: { contains: 'biblored.gov.co' } },
  });
  console.log(`✅ Caché BibloRed eliminado: ${result.count} entradas`);

  const total = await prisma.scrapingCache.count();
  console.log(`   Total entradas restantes en caché: ${total}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
