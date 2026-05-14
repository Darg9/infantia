import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  // 0. Listar TODAS las tablas para entender la BD real
  const allTables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  console.log('=== TODAS LAS TABLAS ===');
  allTables.forEach(t => console.log(' ', t.tablename));

  // 1. ¿Existen las tablas de telemetría?
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('date_preflight_logs', 'source_run_metrics', 'source_health')
    ORDER BY tablename
  `;
  console.log('\nTablas de telemetría:', tables.map(t => t.tablename));

  // 2. Columnas de date_preflight_logs
  if (tables.find(t => t.tablename === 'date_preflight_logs')) {
    const cols = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'date_preflight_logs' ORDER BY ordinal_position
    `;
    console.log('\nColumnas date_preflight_logs:');
    cols.forEach(c => console.log(' ', c.column_name, ':', c.data_type));
  } else {
    console.log('\n⚠️  date_preflight_logs NO EXISTE en la BD');
  }

  // 3. Columnas de source_run_metrics
  if (tables.find(t => t.tablename === 'source_run_metrics')) {
    const cols = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'source_run_metrics' ORDER BY ordinal_position
    `;
    console.log('\nColumnas source_run_metrics:');
    cols.forEach(c => console.log(' ', c.column_name, ':', c.data_type));
  } else {
    console.log('\n⚠️  source_run_metrics NO EXISTE en la BD');
  }

  // 4. Test insert date_preflight_logs
  console.log('\n--- TEST INSERT date_preflight_logs ---');
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO date_preflight_logs
         (source_id, url, raw_date_text, parsed_date, reason, used_fallback, skip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      null, 'https://test.com/diag', null, null, 'process', false, false
    );
    console.log('✅ INSERT OK');
    await prisma.$executeRaw`DELETE FROM date_preflight_logs WHERE url = 'https://test.com/diag'`;
  } catch (e: unknown) {
    console.log('❌ ERROR:', e instanceof Error ? e.message : String(e));
  }

  // 5. Test insert source_run_metrics
  console.log('\n--- TEST INSERT source_run_metrics ---');
  try {
    await prisma.$executeRaw`
      INSERT INTO source_run_metrics
        (source_id, urls_scraped, urls_after_preflight, gemini_ok, fallback_count, activities_saved)
      VALUES (${'21541a9b-a3a5-43da-b951-f6591fda595f'}::uuid, ${0}, ${0}, ${0}, ${0}, ${0})
    `;
    console.log('✅ INSERT OK');
    await prisma.$executeRaw`DELETE FROM source_run_metrics WHERE source_id = '21541a9b-a3a5-43da-b951-f6591fda595f' AND urls_scraped = 0`;
  } catch (e: unknown) {
    console.log('❌ ERROR:', e instanceof Error ? e.message : String(e));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
