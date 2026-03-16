import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/default.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const sources = await prisma.scrapingSource.findMany({
  include: { _count: { select: { activities: true } } },
  orderBy: { createdAt: 'asc' },
});

console.log('\n=== FUENTES DE SCRAPING ===');
for (const s of sources) {
  console.log(`  [${s.id.substring(0,8)}] ${s.name} | ${s.url} | ${s._count.activities} actividades`);
}

const total = await prisma.activity.count();
const free = await prisma.activity.count({ where: { pricePeriod: 'FREE' } });
const byType = await prisma.activity.groupBy({ by: ['type'], _count: true });
const byStatus = await prisma.activity.groupBy({ by: ['status'], _count: true });
const highConf = await prisma.activity.count({ where: { confidenceScore: { gte: 0.7 } } });

console.log(`\n=== RESUMEN TOTAL ===`);
console.log(`  Total actividades: ${total}`);
console.log(`  Gratis: ${free} | De pago: ${total - free}`);
console.log(`  Alta confianza (≥0.7): ${highConf} (${Math.round(highConf/total*100)}%)`);
console.log(`  Por tipo: ${byType.map(t => `${t.type}:${t._count}`).join(' | ')}`);
console.log(`  Por status: ${byStatus.map(s => `${s.status}:${s._count}`).join(' | ')}`);

// Muestra 3 actividades recientes de cada fuente
for (const s of sources) {
  const activities = await prisma.activity.findMany({
    where: { sourceId: s.id },
    include: {
      categories: { include: { category: true } },
      location: { include: { city: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  const srcTotal = await prisma.activity.count({ where: { sourceId: s.id } });
  const srcFree = await prisma.activity.count({ where: { sourceId: s.id, pricePeriod: 'FREE' } });
  const srcHighConf = await prisma.activity.count({ where: { sourceId: s.id, confidenceScore: { gte: 0.7 } } });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`FUENTE: ${s.name.toUpperCase()}`);
  console.log(`URL base: ${s.url}`);
  console.log(`Total: ${srcTotal} | Gratis: ${srcFree} | Alta confianza: ${srcHighConf} (${Math.round(srcHighConf/srcTotal*100)}%)`);
  console.log(`Últimas ${activities.length} actividades scrapeadas:`);

  for (const a of activities) {
    console.log(`\n  ── ${a.title}`);
    console.log(`     Categorías: ${a.categories.map(c => c.category.name).join(', ') || 'N/A'}`);
    console.log(`     Precio: ${a.pricePeriod === 'FREE' ? 'GRATIS' : `${a.price} ${a.priceCurrency}/${a.pricePeriod}`}`);
    console.log(`     Ciudad: ${a.location?.city?.name ?? 'N/A'}`);
    console.log(`     Confianza: ${a.confidenceScore}`);
    console.log(`     URL: ${a.sourceUrl}`);
  }
}

await prisma.$disconnect();
