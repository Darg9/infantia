// check-sources.ts — Verifica datos en DB por fuente de scraping
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function checkSource(label: string, urlPattern: string) {
  const total = await prisma.activity.count({
    where: { sourceUrl: { contains: urlPattern } },
  });
  const free = await prisma.activity.count({
    where: { sourceUrl: { contains: urlPattern }, pricePeriod: 'FREE' },
  });
  const highConf = await prisma.activity.count({
    where: { sourceUrl: { contains: urlPattern }, sourceConfidence: { gte: 0.7 } },
  });
  const byType = await prisma.activity.groupBy({
    by: ['type'],
    where: { sourceUrl: { contains: urlPattern } },
    _count: { _all: true },
  });

  const samples = await prisma.activity.findMany({
    where: { sourceUrl: { contains: urlPattern } },
    include: {
      categories: { include: { category: true } },
      location: { include: { city: true } },
      provider: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 4,
  });

  console.log(`\n${'='.repeat(65)}`);
  console.log(`FUENTE: ${label.toUpperCase()}`);
  console.log(`Patrón URL: *${urlPattern}*`);
  console.log(`Total actividades: ${total}`);
  console.log(`Gratis: ${free} (${total ? Math.round((free / total) * 100) : 0}%) | De pago: ${total - free}`);
  console.log(`Alta confianza (>=0.7): ${highConf} (${total ? Math.round((highConf / total) * 100) : 0}%)`);
  console.log(`Por tipo: ${byType.map((t) => `${t.type}:${t._count._all}`).join(' | ')}`);
  console.log(`\nUltimas ${samples.length} actividades:`);

  for (const a of samples) {
    const precio =
      a.pricePeriod === 'FREE'
        ? 'GRATIS'
        : a.price
          ? `${Number(a.price).toLocaleString('es-CO')} ${a.priceCurrency}/${a.pricePeriod}`
          : 'Sin precio';
    const cats = a.categories.map((c) => c.category.name).join(', ') || 'Sin categoria';
    const ciudad = a.location?.city?.name ?? 'Sin ciudad';
    console.log(`\n  -- ${a.title}`);
    console.log(`     Categorias : ${cats}`);
    console.log(`     Precio     : ${precio}`);
    console.log(`     Ciudad     : ${ciudad}`);
    console.log(`     Proveedor  : ${a.provider.name}`);
    console.log(`     Confianza  : ${a.sourceConfidence}`);
    console.log(`     URL        : ${a.sourceUrl}`);
  }
}

async function main() {
  const total = await prisma.activity.count();
  const free = await prisma.activity.count({ where: { pricePeriod: 'FREE' } });
  const byType = await prisma.activity.groupBy({ by: ['type'], _count: { _all: true } });
  const byStatus = await prisma.activity.groupBy({ by: ['status'], _count: { _all: true } });

  console.log(`\nINFANTIA -- DIAGNOSTICO DE FUENTES`);
  console.log(`${'='.repeat(65)}`);
  console.log(`Total actividades en DB : ${total}`);
  console.log(`Gratis                  : ${free} (${Math.round((free / total) * 100)}%)`);
  console.log(`De pago                 : ${total - free}`);
  console.log(`Por tipo  : ${byType.map((t) => `${t.type}:${t._count._all}`).join(' | ')}`);
  console.log(`Por estado: ${byStatus.map((s) => `${s.status}:${s._count._all}`).join(' | ')}`);

  await checkSource('BibloRed', 'biblored.gov.co');
  await checkSource('Alcaldia de Bogota (bogota.gov.co)', 'bogota.gov.co');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
