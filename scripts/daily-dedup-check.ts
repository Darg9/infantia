import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { calculateSimilarity, normalizeString } from '../src/modules/scraping/deduplication';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const p = new PrismaClient({ adapter });

interface DuplicateIssue {
  type: 'exact' | 'residual' | 'manual-review';
  similarity: number;
  activities: { id: string; title: string; startDate: Date | null }[];
}

async function dailyDedupCheck() {
  console.log(`\n[DAILY] ${new Date().toISOString()} - Verificación diaria de duplicados\n`);

  const issues: DuplicateIssue[] = [];
  let autoRemoved = 0;

  try {
    // 1. DETECTAR DUPLICADOS EXACTOS (fingerprint)
    console.log('═'.repeat(80));
    console.log('1️⃣  Buscando duplicados exactos...');
    console.log('═'.repeat(80));

    const activities = await p.activity.findMany({
      select: { id: true, title: true, startDate: true },
      orderBy: { createdAt: 'desc' },
    });

    const titleMap = new Map<string, typeof activities>();
    activities.forEach(a => {
      const key = normalizeString(a.title);
      if (!titleMap.has(key)) titleMap.set(key, []);
      titleMap.get(key)!.push(a);
    });

    // Encontrar exactos (mismo título normalizado)
    const exactDups = Array.from(titleMap.entries()).filter(([_, items]) => items.length > 1);

    if (exactDups.length > 0) {
      console.log(`⚠️  ${exactDups.length} grupos de exactos encontrados\n`);

      for (const [normalized, items] of exactDups) {
        // Mantener el primero, eliminar los demás
        const toRemove = items.slice(1);
        console.log(`  "${normalized}"`);
        console.log(`  → Mantener: ${items[0].id}`);
        console.log(`  → Eliminar: ${toRemove.length} copia(s)`);

        const deleted = await p.activity.deleteMany({
          where: { id: { in: toRemove.map(x => x.id) } },
        });

        autoRemoved += deleted.count;
        console.log(`  ✅ Eliminadas ${deleted.count}\n`);

        issues.push({
          type: 'exact',
          similarity: 100,
          activities: items,
        });
      }
    } else {
      console.log('✅ No hay duplicados exactos\n');
    }

    // 2. DETECTAR SIMILARES PARA REVISIÓN MANUAL (70-90%)
    console.log('═'.repeat(80));
    console.log('2️⃣  Buscando similares para revisión (70-90%)...');
    console.log('═'.repeat(80));

    const recentActivities = await p.activity.findMany({
      select: { id: true, title: true, startDate: true },
      orderBy: { createdAt: 'desc' },
      take: 200, // Últimas 200 para búsqueda rápida
    });

    const similarPairs: Array<{
      sim: number;
      a1: (typeof recentActivities)[0];
      a2: (typeof recentActivities)[0];
    }> = [];

    for (let i = 0; i < recentActivities.length; i++) {
      for (let j = i + 1; j < recentActivities.length; j++) {
        const sim = calculateSimilarity(
          recentActivities[i].title,
          recentActivities[j].title
        );

        if (sim >= 70 && sim < 100) {
          // Excluir exactos (ya fueron limpiados)
          similarPairs.push({
            sim,
            a1: recentActivities[i],
            a2: recentActivities[j],
          });
        }
      }
    }

    if (similarPairs.length > 0) {
      // Mostrar solo los más recientes (últimos 5)
      const topSimilar = similarPairs
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 5);

      console.log(`⚠️  ${topSimilar.length} similares requieren revisión manual\n`);

      topSimilar.forEach((pair, idx) => {
        console.log(`  [${idx + 1}] ${pair.sim}% similar:`);
        console.log(`     A: "${pair.a1.title}"`);
        console.log(`        ID: ${pair.a1.id} | ${pair.a1.startDate || 'sin fecha'}`);
        console.log(`     B: "${pair.a2.title}"`);
        console.log(`        ID: ${pair.a2.id} | ${pair.a2.startDate || 'sin fecha'}`);
        console.log('');

        issues.push({
          type: 'manual-review',
          similarity: pair.sim,
          activities: [pair.a1, pair.a2],
        });
      });
    } else {
      console.log('✅ No hay similares para revisar\n');
    }

    // 3. ESTADÍSTICAS
    console.log('═'.repeat(80));
    console.log('📊 RESUMEN DIARIO');
    console.log('═'.repeat(80));

    const totalCount = await p.activity.count();
    const uniqueTitles = await p.activity.findMany({
      select: { title: true },
      distinct: ['title'],
    });

    console.log(`Total actividades: ${totalCount}`);
    console.log(`Títulos únicos: ${uniqueTitles.length}`);
    console.log(`Duplicados eliminados hoy: ${autoRemoved}`);
    console.log(`Similares para revisar: ${exactDups.length > 0 || similarPairs.length > 0 ? 'Sí' : 'No'}`);
    console.log(`Salud de datos: ${((uniqueTitles.length / totalCount) * 100).toFixed(1)}%\n`);

    // 4. REPORTE JSON (para logging)
    const report = {
      timestamp: new Date().toISOString(),
      totalActivities: totalCount,
      uniqueTitles: uniqueTitles.length,
      autoRemovedCount: autoRemoved,
      issues: issues.map(i => ({
        type: i.type,
        similarity: i.similarity,
        count: i.activities.length,
        titles: i.activities.map(a => a.title),
      })),
    };

    console.log('[REPORT] ' + JSON.stringify(report));

    if (autoRemoved > 0) {
      console.log(`\n✅ ${autoRemoved} duplicados eliminados automáticamente`);
    }

    if (similarPairs.length > 0) {
      console.log(`\n⚠️  REVISAR MANUALMENTE: ${similarPairs.length} pares similares`);
      console.log('   Ver logs para detalles\n');
    }

    await p.$disconnect();
  } catch (err) {
    console.error('\n[ERROR]', err);
    process.exit(1);
  }
}

dailyDedupCheck().catch(console.error);
