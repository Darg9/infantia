// =============================================================================
// db-run-migration.ts — Aplica la migración de tablas de telemetría faltantes
//
// Crea date_preflight_logs y source_run_metrics si no existen.
// Idempotente: usa CREATE TABLE IF NOT EXISTS.
//
// Uso:
//   npx tsx scripts/db-run-migration.ts [--dry-run]
// =============================================================================
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const DRY_RUN = process.argv.includes('--dry-run');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const sqlPath = path.resolve(
    process.cwd(),
    'prisma/migrations/20260513000000_add_missing_telemetry_tables/migration.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // Dividir en statements ejecutables, eliminando líneas de comentario dentro de cada uno
  const statements = sql
    .split(';')
    .map(s =>
      s.split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .trim()
    )
    .filter(s => s.length > 0);

  console.log(`📋 ${statements.length} statements a ejecutar${DRY_RUN ? ' (DRY RUN)' : ''}`);

  if (DRY_RUN) {
    statements.forEach((s, i) => console.log(`  [${i + 1}] ${s.slice(0, 80)}...`));
    console.log('\n✅ Dry run completado — sin cambios en BD');
    return;
  }

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt + ';');
      const label = stmt.match(/^(CREATE TABLE|CREATE INDEX|COMMENT ON)/i)?.[0] ?? stmt.slice(0, 40);
      console.log(`  ✅ ${label}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ❌ ERROR: ${msg}`);
      throw e; // Fallar rápido en caso de error no esperado
    }
  }

  console.log('\n✅ Migración aplicada. Verificando...\n');

  // Verificar que las tablas existen
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('date_preflight_logs', 'source_run_metrics')
    ORDER BY tablename
  `;
  tables.forEach(t => console.log(`  ✅ Tabla '${t.tablename}' confirmada en BD`));

  if (tables.length < 2) {
    console.error('\n❌ Alguna tabla no se creó correctamente');
    process.exit(1);
  }

  // Test insert real
  console.log('\n--- Verificando inserts ---');
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO date_preflight_logs
         (source_id, url, raw_date_text, parsed_date, reason, used_fallback, skip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      null, 'https://test.com/migration-verify', null, null, 'process', false, false
    );
    await prisma.$executeRaw`DELETE FROM date_preflight_logs WHERE url = 'https://test.com/migration-verify'`;
    console.log('  ✅ date_preflight_logs: INSERT OK');
  } catch (e: unknown) {
    console.error('  ❌ date_preflight_logs INSERT:', e instanceof Error ? e.message : String(e));
  }

  try {
    await prisma.$executeRaw`
      INSERT INTO source_run_metrics
        (source_id, urls_scraped, urls_after_preflight, gemini_ok, fallback_count, activities_saved)
      SELECT id, 0, 0, 0, 0, 0 FROM scraping_sources LIMIT 1
    `;
    await prisma.$executeRaw`
      DELETE FROM source_run_metrics
      WHERE id = (SELECT id FROM source_run_metrics ORDER BY run_at DESC LIMIT 1)
        AND urls_scraped = 0
    `;
    console.log('  ✅ source_run_metrics: INSERT OK');
  } catch (e: unknown) {
    console.error('  ❌ source_run_metrics INSERT:', e instanceof Error ? e.message : String(e));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
