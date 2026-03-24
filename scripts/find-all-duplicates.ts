import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  normalizeString,
  generateActivityFingerprint,
  calculateSimilarity,
  isProbablyDuplicate,
} from '../src/modules/scraping/deduplication';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const p = new PrismaClient({ adapter });

interface ActivityWithMetadata {
  id: string;
  title: string;
  startDate: Date | null;
  provider: { name: string };
  sourceUrl: string | null;
  normalizedTitle: string;
  fingerprint: string;
}

async function findAllDuplicates() {
  console.log('\n[DUPLICATES] Analizando todas las actividades...\n');

  // Obtener todas las actividades con sus proveedores
  const activities = await p.activity.findMany({
    select: {
      id: true,
      title: true,
      startDate: true,
      provider: { select: { name: true } },
      sourceUrl: true,
    },
    orderBy: { title: 'asc' },
  });

  console.log(`Total actividades: ${activities.length}\n`);

  // Preparar datos enriquecidos
  const enriched: ActivityWithMetadata[] = activities.map(a => ({
    ...a,
    normalizedTitle: normalizeString(a.title),
    fingerprint: generateActivityFingerprint(a.title, a.startDate?.toISOString()),
  }));

  // 1. DUPLICADOS EXACTOS (mismo fingerprint)
  console.log('═'.repeat(80));
  console.log('1️⃣  DUPLICADOS EXACTOS (mismo fingerprint)');
  console.log('═'.repeat(80));

  const fingerprintMap = new Map<string, ActivityWithMetadata[]>();
  enriched.forEach(a => {
    if (!fingerprintMap.has(a.fingerprint)) {
      fingerprintMap.set(a.fingerprint, []);
    }
    fingerprintMap.get(a.fingerprint)!.push(a);
  });

  const exactDups = Array.from(fingerprintMap.entries())
    .filter(([_, items]) => items.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  if (exactDups.length === 0) {
    console.log('✅ No hay duplicados exactos\n');
  } else {
    console.log(`❌ ${exactDups.length} grupos de duplicados exactos encontrados\n`);
    exactDups.forEach(([fp, items], idx) => {
      console.log(`  [${idx + 1}] ${items.length} copias:`);
      items.forEach((a, i) => {
        console.log(
          `      ${i + 1}. "${a.title.substring(0, 60)}" (${a.provider.name})`
        );
        console.log(`         ID: ${a.id}`);
      });
      console.log('');
    });
  }

  // 2. DUPLICADOS POR SIMILITUD (70%+)
  console.log('═'.repeat(80));
  console.log('2️⃣  DUPLICADOS POR SIMILITUD (70%+ similar)');
  console.log('═'.repeat(80));

  const similarGroups = new Map<string, { activities: ActivityWithMetadata[]; maxSimilarity: number }>();

  for (let i = 0; i < enriched.length; i++) {
    for (let j = i + 1; j < enriched.length; j++) {
      const a1 = enriched[i];
      const a2 = enriched[j];

      // Saltar si ya está en un grupo de exactos
      if (a1.fingerprint === a2.fingerprint) continue;

      const similarity = calculateSimilarity(a1.normalizedTitle, a2.normalizedTitle);

      if (similarity >= 70) {
        // Crear clave única para el grupo
        const key = [a1.id, a2.id].sort().join('|');

        if (!similarGroups.has(key)) {
          similarGroups.set(key, {
            activities: [a1],
            maxSimilarity: similarity,
          });
        }
        similarGroups.get(key)!.activities.push(a2);
        similarGroups.get(key)!.maxSimilarity = Math.max(
          similarGroups.get(key)!.maxSimilarity,
          similarity
        );
      }
    }
  }

  const similarDups = Array.from(similarGroups.values())
    .sort((a, b) => b.maxSimilarity - a.maxSimilarity)
    .slice(0, 50); // Mostrar top 50

  if (similarDups.length === 0) {
    console.log('✅ No hay duplicados por similitud\n');
  } else {
    console.log(`⚠️  ${similarDups.length} pares similares encontrados\n`);
    similarDups.forEach((group, idx) => {
      const [a1, a2] = group.activities;
      const sim = group.maxSimilarity;
      console.log(`  [${idx + 1}] ${sim}% similar:`);
      console.log(`      A: "${a1.title.substring(0, 55)}" (${a1.provider.name})`);
      console.log(`         ID: ${a1.id}`);
      console.log(`      B: "${a2.title.substring(0, 55)}" (${a2.provider.name})`);
      console.log(`         ID: ${a2.id}`);
      console.log('');
    });
  }

  // 3. DUPLICADOS POR TÍTULO NORMALIZADO
  console.log('═'.repeat(80));
  console.log('3️⃣  DUPLICADOS PARCIALES (mismo título normalizado)');
  console.log('═'.repeat(80));

  const normalizedMap = new Map<string, ActivityWithMetadata[]>();
  enriched.forEach(a => {
    if (!normalizedMap.has(a.normalizedTitle)) {
      normalizedMap.set(a.normalizedTitle, []);
    }
    normalizedMap.get(a.normalizedTitle)!.push(a);
  });

  const partialDups = Array.from(normalizedMap.entries())
    .filter(([_, items]) => items.length > 1 && items[0].fingerprint !== items[1].fingerprint)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 30); // Top 30

  if (partialDups.length === 0) {
    console.log('✅ No hay duplicados parciales\n');
  } else {
    console.log(`⚠️  ${partialDups.length} grupos de títulos duplicados encontrados\n`);
    partialDups.forEach(([normalized, items], idx) => {
      console.log(`  [${idx + 1}] ${items.length} actividades con mismo título normalizado:`);
      console.log(`      "${normalized}"`);
      items.forEach((a, i) => {
        console.log(
          `      ${i + 1}. "${a.title}" (${a.provider.name}) - ID: ${a.id}`
        );
      });
      console.log('');
    });
  }

  // RESUMEN
  console.log('═'.repeat(80));
  console.log('📊 RESUMEN');
  console.log('═'.repeat(80));
  console.log(`Total actividades: ${enriched.length}`);
  console.log(`Duplicados exactos: ${exactDups.reduce((sum, [_, items]) => sum + (items.length - 1), 0)} extras`);
  console.log(`Duplicados similares: ${similarDups.length} pares`);
  console.log(`Duplicados parciales: ${partialDups.reduce((sum, [_, items]) => sum + (items.length - 1), 0)} extras`);
  console.log('');

  // Exportar lista de IDs a eliminar (candidatos)
  const toDelete: string[] = [];

  // De exactos: mantener el primero, eliminar el resto
  exactDups.forEach(([_, items]) => {
    items.slice(1).forEach(a => toDelete.push(a.id));
  });

  console.log(`💾 Total candidatos para eliminar: ${toDelete.length} actividades`);
  if (toDelete.length > 0) {
    console.log('   IDs a eliminar:');
    toDelete.forEach((id, i) => {
      if (i % 5 === 0) console.log('');
      process.stdout.write(`   ${id}  `);
    });
    console.log('\n');
  }

  await p.$disconnect();
}

findAllDuplicates().catch(console.error);
