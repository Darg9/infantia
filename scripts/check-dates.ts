import 'dotenv/config';
import { prisma } from '../src/lib/db';

async function main() {
  const now = new Date();
  const [future, past, noDate] = await Promise.all([
    prisma.activity.count({ where: { startDate: { gte: now } } }),
    prisma.activity.count({ where: { startDate: { lt: now } } }),
    prisma.activity.count({ where: { startDate: null } }),
  ]);
  console.log(`futuras: ${future} | pasadas: ${past} | sin fecha: ${noDate} | total: ${future + past + noDate}`);

  const sample = await prisma.activity.findMany({
    where: { startDate: { gte: now } },
    select: { title: true, startDate: true, provider: { select: { name: true } } },
    orderBy: { startDate: 'asc' },
    take: 8,
  });
  if (sample.length === 0) {
    console.log('(ninguna actividad futura con startDate)');
  } else {
    sample.forEach((a) =>
      console.log(a.startDate?.toISOString().slice(0, 10), '|', a.provider?.name?.slice(0, 30), '|', a.title?.slice(0, 60)),
    );
  }
  await prisma.$disconnect();
}

main().catch(console.error);
