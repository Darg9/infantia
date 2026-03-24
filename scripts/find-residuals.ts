import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const p = new PrismaClient({ adapter });

async function findResiduals() {
  console.log('\n[FIND] Buscando pares residuales...\n');

  // Par 1: Lecturas y texturas
  const lecturas = await p.activity.findMany({
    where: {
      title: { in: ['Lecturas y texturas para bebés', '¡Lecturas y texturas para bebés!'] }
    },
    select: { id: true, title: true }
  });

  console.log('Par 1: Lecturas y texturas');
  lecturas.forEach(a => console.log(`  ${a.id}: "${a.title}"`));

  // Par 2: Laboratorio gráfico
  const lab = await p.activity.findMany({
    where: {
      title: { in: ['Laboratorio gráfico infantil: mamarracho', 'Laboratorio Gráfico Infantil: Mamarracho'] }
    },
    select: { id: true, title: true }
  });

  console.log('\nPar 2: Laboratorio gráfico');
  lab.forEach(a => console.log(`  ${a.id}: "${a.title}"`));

  await p.$disconnect();
}

findResiduals().catch(console.error);
