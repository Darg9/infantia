import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const p = new PrismaClient({ adapter });

async function checkDuplicates() {
  console.log('\n[CHECK] Analizando duplicados...\n');

  const activities = await p.activity.findMany({
    select: { id: true, title: true, createdAt: true },
  });

  const titleMap = new Map<string, any[]>();
  activities.forEach(a => {
    const key = a.title.toLowerCase().trim();
    if (!titleMap.has(key)) titleMap.set(key, []);
    titleMap.get(key)!.push(a);
  });

  const duplicates = Array.from(titleMap.entries())
    .filter(([_, items]) => items.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`Total actividades: ${activities.length}`);
  console.log(`Títulos únicos: ${titleMap.size}`);
  console.log(`Duplicados encontrados: ${duplicates.length}\n`);

  if (duplicates.length > 0) {
    console.log('Top 10 duplicados:');
    duplicates.slice(0, 10).forEach(([title, items]) => {
      console.log(`  ${items.length}x: "${title.substring(0, 70)}"`);
    });
  }

  await p.$disconnect();
}

checkDuplicates().catch(console.error);
