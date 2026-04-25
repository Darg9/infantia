import { prisma } from '../src/lib/db';

async function main() {
  console.log('--- Resumen de Actividades ---');
  const counts = await prisma.activity.groupBy({
    by: ['status'],
    _count: true
  });
  console.table(counts);

  console.log('\n--- Resumen de PQRS ---');
  const pqrs = await prisma.contactRequest.groupBy({
    by: ['status'],
    _count: true
  });
  console.table(pqrs);

  console.log('\n--- Fuentes Activas ---');
  const sources = await prisma.scrapingSource.count({ where: { isActive: true } });
  console.log(`Fuentes activas: ${sources}`);
}

main().finally(() => prisma.$disconnect());
