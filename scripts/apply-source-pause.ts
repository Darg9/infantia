#!/usr/bin/env npx tsx
import { getErrorMessage } from '../src/lib/error';
/**
 * Script: apply-source-pause
 * Ejecuta la lógica de auto-pause de fuentes basado en URL scores
 *
 * Uso:
 *   npx tsx scripts/apply-source-pause.ts [--dry-run] [--city=<cityId>] [--verbose]
 *
 * Ejemplos:
 *   npx tsx scripts/apply-source-pause.ts --dry-run          # Preview sin guardar
 *   npx tsx scripts/apply-source-pause.ts --city=bogota       # Solo para Bogotá
 *   npx tsx scripts/apply-source-pause.ts --verbose           # Con logs detallados
 */

import 'dotenv/config';
import { prisma } from '../src/lib/db';
import {
  pauseSourceIfNeeded,
  unpausSourceIfExpired,
  getSourceDashboardStats,
} from '../src/lib/source-pause-manager';
import { createLogger } from '../src/lib/logger';

const log = createLogger('script:apply-source-pause');

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');
const cityArg = args.find((a) => a.startsWith('--city='))?.split('=')[1];

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🔄 APPLY SOURCE PAUSE — Auto-pause logic');
  console.log('='.repeat(70));
  console.log(`\n📋 Opciones:`);
  console.log(`  Dry-run: ${dryRun ? 'SÍ' : 'NO'}`);
  console.log(`  Verbose: ${verbose ? 'SÍ' : 'NO'}`);
  console.log(`  City: ${cityArg || 'ALL'}\n`);

  try {
    // 1. Obtener todas las fuentes
    const sources = await prisma.scrapingSource.findMany({
      where: cityArg ? { cityId: cityArg } : undefined,
      include: { city: true },
    });

    console.log(`📊 Procesando ${sources.length} fuentes...\n`);

    const results = {
      paused: [] as Array<{ sourceId: string; sourceName: string; score: number }>,
      unpaused: [] as Array<{ sourceId: string; sourceName: string }>,
      errors: [] as Array<{ sourceId: string; error: string }>,
    };

    // 2. Para cada fuente: check auto-pause y auto-unpause
    for (const source of sources) {
      try {
        // 2a. Intentar despausa si expiró
        const unpauseResult = await unpausSourceIfExpired(source.id, source.cityId);
        if (unpauseResult.unpaused) {
          results.unpaused.push({
            sourceId: source.id,
            sourceName: `${source.name}${source.cityId ? ` (${source.city?.name})` : ''}`,
          });
          if (verbose) {
            console.log(`  ✅ Unpause ${source.name}: paused for ${unpauseResult.pausedFor} days`);
          }
        }

        // 2b. Intentar pausa si score < threshold
        const pauseResult = await pauseSourceIfNeeded(source.id, source.cityId);
        if (pauseResult.paused) {
          results.paused.push({
            sourceId: source.id,
            sourceName: `${source.name}${source.cityId ? ` (${source.city?.name})` : ''}`,
            score: pauseResult.score || 0,
          });
          if (verbose) {
            console.log(`  ⏸️  Pause ${source.name}: score ${pauseResult.score}`);
          }
        } else if (verbose && pauseResult.reason !== 'score_above_threshold') {
          console.log(`  ℹ️  No action ${source.name}: ${pauseResult.reason}`);
        }
      } catch (error: unknown) {
        results.errors.push({
          sourceId: source.id,
          error: getErrorMessage(error),
        });
        log.error(`Error processing source ${source.id}`, { error });
      }
    }

    // 3. Resumen
    console.log('\n' + '='.repeat(70));
    console.log('📊 RESUMEN');
    console.log('='.repeat(70));
    console.log(`\n✅ Unpaused: ${results.unpaused.length}`);
    if (results.unpaused.length > 0) {
      results.unpaused.forEach((r) => console.log(`   • ${r.sourceName}`));
    }

    console.log(`\n⏸️  Paused: ${results.paused.length}`);
    if (results.paused.length > 0) {
      results.paused.forEach((r) => console.log(`   • ${r.sourceName} (score: ${r.score})`));
    }

    console.log(`\n❌ Errors: ${results.errors.length}`);
    if (results.errors.length > 0) {
      results.errors.forEach((e) => console.log(`   • ${e.sourceId}: ${e.error}`));
    }

    // 4. Dashboard snapshot
    console.log('\n' + '-'.repeat(70));
    console.log('📈 DASHBOARD SNAPSHOT');
    console.log('-'.repeat(70));

    const stats = await getSourceDashboardStats(cityArg);
    const summary = {
      total: stats.length,
      active: stats.filter((s) => s.is_active).length,
      paused: stats.filter((s) => s.paused_at).length,
      lowQuality: stats.filter((s) => s.avg_url_score && parseFloat(String(s.avg_url_score)) < 45)
        .length,
    };

    console.log(`\n  Total sources: ${summary.total}`);
    console.log(`  Active: ${summary.active}`);
    console.log(`  Paused: ${summary.paused}`);
    console.log(`  Low quality (<45): ${summary.lowQuality}\n`);

    if (dryRun) {
      console.log('⚠️  DRY RUN MODE — cambios NO fueron guardados\n');
    } else {
      console.log('✨ Cambios guardados en BD\n');
    }

    console.log('='.repeat(70) + '\n');
  } catch (error: unknown) {
    console.error('\n❌ Error en script:', getErrorMessage(error));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
