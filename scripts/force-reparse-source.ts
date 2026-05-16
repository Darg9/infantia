// =============================================================================
// force-reparse-source.ts — Re-parsea actividades existentes de una fuente
//
// Cuándo usar:
//   - Actividades pre-V2 sin fechas (idartes, biblored, etc.)
//   - Fuente procesada con Cheerio fallback que necesita Gemini
//   - El parser mejoró y queremos backfill de actividades existentes
//
// Flujo:
//   1. Busca actividades en BD de la fuente (por sourceDomain)
//   2. Para cada URL: fetch HTML → Gemini → update campos temporales en BD
//   3. Actualiza cache (disco + BD)
//   4. Reporta: updated / no_change / failed / skipped
//
// Uso:
//   npx tsx scripts/force-reparse-source.ts --source=idartes
//   npx tsx scripts/force-reparse-source.ts --source=idartes --dry-run
//   npx tsx scripts/force-reparse-source.ts --source=idartes --limit=20
//   npx tsx scripts/force-reparse-source.ts --source=idartes --only-missing-dates
//   npx tsx scripts/force-reparse-source.ts --source=biblored --limit=50 --dry-run
// =============================================================================

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../src/generated/prisma/client';
import { GeminiAnalyzer } from '../src/modules/scraping/nlp/gemini.analyzer';
import { ScrapingCache } from '../src/modules/scraping/cache';
import { quota } from '../src/lib/quota-tracker';
import type { ActivityNLPResult } from '../src/modules/scraping/types';

// ── Args ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const sourceArg        = args.find(a => a.startsWith('--source='))?.replace('--source=', '').trim();
const limitArg         = parseInt(args.find(a => a.startsWith('--limit='))?.replace('--limit=', '') ?? '50');
const dryRun           = args.includes('--dry-run');
const onlyMissingDates = args.includes('--only-missing-dates');
const help             = args.includes('--help') || args.includes('-h');

if (help || !sourceArg) {
  console.log(`
Usage: npx tsx scripts/force-reparse-source.ts --source=<slug> [options]

Options:
  --source=<slug>       Source domain keyword (e.g. "idartes", "biblored")  [required]
  --limit=<n>           Max activities to process          (default: 50)
  --dry-run             Show what would happen, no writes
  --only-missing-dates  Only process activities with startDate IS NULL
  --help                Show this message

Examples:
  npx tsx scripts/force-reparse-source.ts --source=idartes --dry-run
  npx tsx scripts/force-reparse-source.ts --source=idartes --limit=20 --only-missing-dates
  npx tsx scripts/force-reparse-source.ts --source=biblored --limit=30
`);
  process.exit(sourceArg ? 0 : 1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Inline de computeTemporalMeta (no exportada de save-activity-v2.ts) */
const EXPLICIT_DATE_RE = /\d{1,2}\s+de\s+\w+|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/i;
const DATE_MENTION_RE  = /hoy|mañana|este\s+fin|esta\s+semana|próximo|próxima|lunes|martes|miércoles|jueves|viernes|sábado|domingo|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/i;

function computeTemporalMeta(
  result: ActivityNLPResult,
  isCheerioFallback: boolean,
): { status: string; dateSource: string; dateMentionDetected: boolean } {
  const hasStartDate = !!result.schedules?.[0]?.startDate;
  const text = `${result.title ?? ''} ${result.description ?? ''}`;

  let dateSource: 'explicit' | 'relative' | 'inferred' | 'none';
  if (!hasStartDate) {
    dateSource = 'none';
  } else if (EXPLICIT_DATE_RE.test(text)) {
    dateSource = 'explicit';
  } else if (DATE_MENTION_RE.test(text)) {
    dateSource = 'relative';
  } else {
    dateSource = 'inferred';
  }

  const status = isCheerioFallback ? 'degraded'
    : hasStartDate ? 'resolved'
    : 'missing';

  const dateMentionDetected = !hasStartDate ? DATE_MENTION_RE.test(text) : false;

  return { status, dateSource, dateMentionDetected };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const adapter  = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma   = new PrismaClient({ adapter });
  const analyzer = new GeminiAnalyzer();
  const cache    = new ScrapingCache(sourceArg!);

  // 1. Verificar cuota Gemini
  const remaining = await quota.getRemaining();
  console.log(`\n🤖 Force Reparse — fuente: "${sourceArg}" | Cuota Gemini: ${remaining} req restantes`);

  if (remaining <= 0 && !dryRun) {
    console.error('❌ Cuota Gemini agotada. Usa --dry-run para inspección o espera el reset (08:00 UTC).');
    await prisma.$disconnect();
    process.exit(1);
  }

  if (dryRun)           console.log('🔍 DRY-RUN: no se guardan cambios en BD');
  if (onlyMissingDates) console.log('📅 Filtro: solo actividades sin fecha de inicio');
  console.log(`📦 Límite: ${limitArg} actividades\n`);

  // 2. Buscar actividades de la fuente
  const where: Prisma.ActivityWhereInput = {
    sourceDomain: { contains: sourceArg },
    status: 'ACTIVE',
    ...(onlyMissingDates ? { startDate: null } : {}),
  };

  const activities = await prisma.activity.findMany({
    where,
    select: {
      id:                  true,
      title:               true,
      sourceUrl:           true,
      sourceDomain:        true,
      startDate:           true,
      extractionMetadata:  true,
    },
    orderBy: { createdAt: 'asc' },
    take: limitArg,
  });

  if (activities.length === 0) {
    console.log(`ℹ️  No se encontraron actividades ACTIVE con sourceDomain conteniendo "${sourceArg}"${onlyMissingDates ? ' y sin startDate' : ''}.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`📋 ${activities.length} actividades encontradas para re-parsear:\n`);

  // 3. Estadísticas
  let updated   = 0;
  let noChange  = 0;
  let failed    = 0;
  let skipped   = 0;

  // 4. Procesar cada actividad
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    const idx = `[${i + 1}/${activities.length}]`;

    if (!act.sourceUrl) {
      console.log(`${idx} ⏭️  ${act.title.substring(0, 60)} — sin sourceUrl`);
      skipped++;
      continue;
    }

    console.log(`${idx} 🔄 ${act.title.substring(0, 60)}`);
    console.log(`       URL: ${act.sourceUrl}`);

    try {
      // Fetch HTML con fetch nativo (sin Playwright — web scraping simple)
      let html: string;
      try {
        const response = await fetch(act.sourceUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HabitaPlan/1.0; +https://habitaplan.com)' },
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) {
          console.log(`       ❌ HTTP ${response.status} — skipped`);
          skipped++;
          continue;
        }
        html = await response.text();
      } catch (fetchErr: unknown) {
        const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        console.log(`       ❌ Fetch error: ${msg.substring(0, 80)} — skipped`);
        skipped++;
        continue;
      }

      if (!html || html.length < 200) {
        console.log(`       ❌ Respuesta vacía o demasiado corta — skipped`);
        skipped++;
        continue;
      }

      // Parse con Gemini (o fallback Cheerio si falla)
      let parseResult: ActivityNLPResult;
      let isCheerioFallback = false;

      if (dryRun) {
        console.log(`       → DRY-RUN: fetch OK (${html.length} chars). Gemini no llamado.`);
        skipped++;
        continue;
      }

      try {
        parseResult = await analyzer.analyze(html, act.sourceUrl);
        console.log(`       ✅ Gemini: "${parseResult.title?.substring(0, 50)}"`);
      } catch (geminiErr: unknown) {
        const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
        if (msg.includes('QUOTA_EXHAUSTED')) {
          console.error(`\n❌ Cuota agotada en mitad del proceso. ${updated} actualizadas hasta ahora.`);
          break;
        }
        // Fallback: Gemini no disponible — mantener datos existentes, actualizar solo metadata
        console.warn(`[warn] Gemini falló para ${act.sourceUrl}: ${msg}. Cheerio no extrae fechas — marcando degraded.`);
        parseResult = {
          title:           act.title,
          description:     null,
          isActivity:      true,
          confidenceScore: 0.3,
          schedules:       null,
          categories:      [],
          price:           null,
          currency:        'COP',
          minAge:          null,
          maxAge:          null,
          audience:        'ALL',
          imageUrl:        null,
          pricePeriod:     null,
          parserSource:    'fallback',
        } as ActivityNLPResult;
        isCheerioFallback = true;
        console.log(`       ⚠️  Cheerio fallback (Gemini no disponible)`);
      }

      // Comparar con lo existente
      const newStartDate = parseResult.schedules?.[0]?.startDate
        ? new Date(parseResult.schedules[0].startDate)
        : null;
      const hadDate      = !!act.startDate;
      const getsDate     = !!newStartDate;

      const temporalMeta = computeTemporalMeta(parseResult, isCheerioFallback);

      if (!getsDate && !hadDate) {
        console.log(`       ⏭️  Sin fecha antes ni después — no_change`);
        noChange++;
        // Actualizar igual extractionMetadata para tener V2 metadata
        await prisma.activity.update({
          where: { id: act.id },
          data: {
            extractionMetadata: {
              ...((act.extractionMetadata as Record<string, unknown>) ?? {}),
              temporal: temporalMeta,
              reparsedAt: new Date().toISOString(),
            },
          },
        });
        // Cache: marcar como procesado
        cache.add(act.sourceUrl, parseResult.title ?? act.title, undefined, {
          parserSource:    isCheerioFallback ? 'fallback' : 'gemini',
          confidenceScore: parseResult.confidenceScore ?? 0,
        });
        continue;
      }

      // Update en BD
      await prisma.activity.update({
        where: { id: act.id },
        data: {
          startDate: newStartDate,
          endDate:   parseResult.schedules?.[0]?.endDate
            ? new Date(parseResult.schedules[0].endDate)
            : null,
          schedule: parseResult.schedules
            ? { items: parseResult.schedules }
            : Prisma.JsonNull,
          extractionMetadata: {
            ...((act.extractionMetadata as Record<string, unknown>) ?? {}),
            temporal:    temporalMeta,
            reparsedAt:  new Date().toISOString(),
            reparsedFrom: isCheerioFallback ? 'fallback' : 'gemini',
          },
        },
      });

      // Cache: actualizar entrada
      cache.add(act.sourceUrl, parseResult.title ?? act.title, undefined, {
        parserSource:    isCheerioFallback ? 'fallback' : 'gemini',
        confidenceScore: parseResult.confidenceScore ?? 0,
      });

      const dateSummary = newStartDate
        ? `startDate → ${newStartDate.toISOString().slice(0, 10)}`
        : 'sin fecha (metadata actualizada)';

      console.log(`       ✅ BD actualizada: ${dateSummary}`);
      updated++;

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`       ❌ Error: ${msg.substring(0, 100)}`);
      failed++;
    }
  }

  // 5. Persistir cache
  if (!dryRun) {
    cache.save();
    await cache.saveToDb();
  }

  await prisma.$disconnect();

  // 6. Resumen
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Resumen force-reparse "${sourceArg}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total procesadas : ${activities.length}
  ✅ Actualizadas  : ${updated}
  ⏭️  Sin cambio    : ${noChange}
  🚫 Skipped       : ${skipped}
  ❌ Fallidas      : ${failed}
${dryRun ? '\n  🔍 DRY-RUN — no se guardó nada' : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Próximo paso:
  npx tsx scripts/source-health.ts --min-active=1
`);
}

main().catch((err) => {
  console.error('❌ Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
