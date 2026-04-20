import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ActivityClusterNode, clusterizeNodes } from '../src/modules/deduplication/cluster';
import { resolveClusterWinner } from '../src/modules/deduplication/merger';
import { GeminiAnalyzer } from '../src/modules/scraping/nlp/gemini.analyzer';

const MAX_GEMINI_CHECKS = 50;

async function runDeduplication(dryRun: boolean) {
    console.log(`\n🚀 INICIANDO DEDUPLICACIÓN CROSS-SOURCE`);
    console.log(`   Modo: ${dryRun ? 'DRY RUN (Solo lectura)' : 'EJECUCIÓN REAL'}`);

    const connectionString = `${process.env.DATABASE_URL}`;
    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    // Fetch active activities (Limit surface to active and upcoming)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activitiesRaw = await prisma.activity.findMany({
        where: {
            status: 'ACTIVE',
            canonicalId: null,
            startDate: { gte: thirtyDaysAgo }
        },
        select: {
            id: true,
            title: true,
            startDate: true,
            locationId: true,
            providerId: true,
            sourceDomain: true,
            sourceConfidence: true,
            duplicatesCount: true
        }
    });

    const nodes: ActivityClusterNode[] = activitiesRaw.map(a => ({
        id: a.id,
        title: a.title,
        startDate: a.startDate,
        locationId: a.locationId,
        providerId: a.providerId,
        sourceDomain: a.sourceDomain,
        sourceConfidence: a.sourceConfidence,
        duplicatesCount: a.duplicatesCount
    }));

    console.log(`\n📦 Actividades Candidatas: ${nodes.length}`);

    const clusters = clusterizeNodes(nodes);
    console.log(`🔍 Clusters Encontrados: ${clusters.length}`);

    let geminiChecksUsed = 0;
    let duplicatesMarked = 0;
    const analyzer = new GeminiAnalyzer();

    for (const cluster of clusters) {
        const { resolved, checksUsed } = await resolveClusterWinner(cluster, analyzer, MAX_GEMINI_CHECKS - geminiChecksUsed);
        geminiChecksUsed += checksUsed;

        if (resolved.duplicatesMarked.length > 0) {
           console.log(`\n✨ Cluster Resuelto (Canonical: ${resolved.canonicalId})`);
           for (const dupId of resolved.duplicatesMarked) {
               console.log(`   - 🗑️ Marca Duplicado: ${dupId}`);
               duplicatesMarked++;
               if (!dryRun) {
                   await prisma.$transaction([
                     // Merge views organically
                     prisma.$executeRawUnsafe(`
                        UPDATE "activity_views" SET "activityId" = $1 WHERE "activityId" = $2
                     `, resolved.canonicalId, dupId),
                     // Mark duplicate
                     prisma.activity.update({
                         where: { id: dupId },
                         data: { status: 'DUPLICATE', canonicalId: resolved.canonicalId }
                     }),
                     // Update Canonical Count
                     prisma.activity.update({
                         where: { id: resolved.canonicalId },
                         data: { duplicatesCount: { increment: 1 } }
                     })
                   ]);
               }
           }
        }
    }

    const avgClusterSize = clusters.length > 0 ? (clusters.reduce((sum, c) => sum + Object.keys(c.matches).length + 1, 0) / clusters.length).toFixed(1) : 0;

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 RESUMEN DEDUPLICACIÓN');
    console.log('='.repeat(60));
    console.log(`   Clusters identificados:  ${clusters.length} (Avg size: ${avgClusterSize})`);
    console.log(`   Duplicados interceptados: ${duplicatesMarked}`);
    console.log(`   Tokens Gemini usados:    ${geminiChecksUsed} / ${MAX_GEMINI_CHECKS}`);
    console.log(`\n  ✅ Operación Finalizada\n`);

    await prisma.$disconnect();
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    await runDeduplication(dryRun);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
