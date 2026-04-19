import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Total por status
  const byStatus = await prisma.activity.groupBy({
    by: ['status'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log('\n=== Actividades por estado ===');
  for (const row of byStatus) {
    console.log(`  ${row.status}: ${row._count.id}`);
  }

  // ACTIVE por dominio usando Prisma groupBy
  const activeByDomain = await prisma.activity.groupBy({
    by: ['sourceDomain'],
    where: { status: 'ACTIVE' },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 20,
  });

  console.log('\n=== ACTIVE por dominio ===');
  for (const row of activeByDomain) {
    console.log(`  ${row.sourceDomain || '(sin dominio)'}: ${row._count.id}`);
  }

  // EXPIRED por dominio
  const expiredByDomain = await prisma.activity.groupBy({
    by: ['sourceDomain'],
    where: { status: 'EXPIRED' },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 20,
  });

  console.log('\n=== EXPIRED por dominio ===');
  for (const row of expiredByDomain) {
    console.log(`  ${row.sourceDomain || '(sin dominio)'}: ${row._count.id}`);
  }

  // sourceHealth scores
  const health = await prisma.sourceHealth.findMany({ orderBy: { score: 'asc' } });

  console.log('\n=== Source Health (score < 0.3 = ocultos en portal) ===');
  if (health.length === 0) console.log('  (tabla vacía)');
  for (const h of health) {
    const flag = h.score < 0.3 ? ' ⚠️ OCULTO' : '';
    console.log(`  ${h.source}: ${h.score.toFixed(2)}${flag}`);
  }

  // Últimas 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [total24, active24, expired24] = await Promise.all([
    prisma.activity.count({ where: { createdAt: { gte: since } } }),
    prisma.activity.count({ where: { createdAt: { gte: since }, status: 'ACTIVE' } }),
    prisma.activity.count({ where: { createdAt: { gte: since }, status: 'EXPIRED' } }),
  ]);

  console.log(`\n=== Creadas en últimas 24h ===`);
  console.log(`  Total:   ${total24}`);
  console.log(`  ACTIVE:  ${active24}`);
  console.log(`  EXPIRED: ${expired24}`);

  await prisma.$disconnect();
}

main().catch(console.error);
