// verify-db.ts — Reporte de datos en Supabase
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const totalActivities = await prisma.activity.count();
  const totalProviders = await prisma.provider.count();

  const byType = await prisma.activity.groupBy({ by: ['type'], _count: true });

  const highConf = await prisma.activity.count({ where: { sourceConfidence: { gte: 0.9 } } });
  const midConf  = await prisma.activity.count({ where: { sourceConfidence: { gte: 0.7, lt: 0.9 } } });
  const lowConf  = await prisma.activity.count({ where: { sourceConfidence: { lt: 0.7 } } });

  const withAge = await prisma.activity.count({ where: { ageMin: { not: null } } });
  const free    = await prisma.activity.count({ where: { price: { equals: 0 } } });
  const paid    = await prisma.activity.count({ where: { price: { gt: 0 } } });

  const sample = await prisma.activity.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      title: true,
      type: true,
      ageMin: true,
      ageMax: true,
      price: true,
      sourceConfidence: true,
      categories: { select: { category: { select: { name: true } } } },
    },
  });

  const providers = await prisma.provider.findMany({
    select: { name: true, _count: { select: { activities: true } } },
  });

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║       REPORTE SUPABASE — INFANTIA    ║');
  console.log('╚══════════════════════════════════════╝\n');

  console.log(`📊 Actividades totales : ${totalActivities}`);
  console.log(`🏢 Proveedores         : ${totalProviders}`);

  console.log('\n--- Por tipo de actividad ---');
  byType.forEach((t) => console.log(`  ${String(t.type).padEnd(20)} : ${t._count}`));

  console.log('\n--- Calidad (confianza Gemini) ---');
  console.log(`  Alta  (≥0.9)   : ${highConf} (${((highConf / totalActivities) * 100).toFixed(0)}%)`);
  console.log(`  Media (0.7-0.9): ${midConf}  (${((midConf / totalActivities) * 100).toFixed(0)}%)`);
  console.log(`  Baja  (<0.7)   : ${lowConf}  (${((lowConf / totalActivities) * 100).toFixed(0)}%)`);

  console.log('\n--- Completitud de datos ---');
  console.log(`  Con rango de edad : ${withAge}/${totalActivities} (${((withAge / totalActivities) * 100).toFixed(0)}%)`);
  console.log(`  Gratuitas (0 COP) : ${free}`);
  console.log(`  De pago           : ${paid}`);

  console.log('\n--- Proveedores ---');
  providers.forEach((p) => console.log(`  ${(p.name ?? '').padEnd(30)} : ${p._count.activities} actividades`));

  console.log('\n--- Muestra (5 más recientes) ---');
  sample.forEach((a) => {
    const cats = a.categories.map((c) => c.category.name).join(', ');
    console.log(`\n  📌 ${a.title}`);
    console.log(`     Tipo: ${a.type} | Edad: ${a.ageMin ?? '?'}-${a.ageMax ?? '?'} | Precio: ${a.price ?? 'N/A'} COP | Conf: ${a.sourceConfidence}`);
    console.log(`     Categorías: ${cats || '—'}`);
  });

  console.log('\n');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
