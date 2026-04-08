import 'dotenv/config';
import { prisma } from '../src/lib/db';

async function check() {
  // 1. Verificar existencia de tablas
  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_name IN ('source_pause_config','source_url_stats')
     AND table_schema='public'
     ORDER BY table_name`,
  );
  console.log(`\n📋 Tablas encontradas: ${tables.length}/2`);
  tables.forEach((t) => console.log(`   ✅ ${t.table_name}`));

  if (tables.length < 2) {
    console.error('\n❌ Faltan tablas — re-ejecutar migrate-source-pause.ts');
    process.exit(1);
  }

  // 2. Verificar columnas de source_pause_config
  const cols = await prisma.$queryRawUnsafe<{ column_name: string; data_type: string }[]>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'source_pause_config'
     ORDER BY ordinal_position`,
  );
  console.log(`\n📐 Columnas source_pause_config (${cols.length}):`);
  cols.forEach((c) => console.log(`   ${c.column_name} — ${c.data_type}`));

  // 3. Verificar índices
  const indexes = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
    `SELECT indexname FROM pg_indexes
     WHERE tablename IN ('source_pause_config','source_url_stats')
     ORDER BY indexname`,
  );
  console.log(`\n🔍 Índices (${indexes.length}):`);
  indexes.forEach((i) => console.log(`   ✅ ${i.indexname}`));

  // 4. Verificar FK apuntando a una fuente real
  const sources = await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(
    `SELECT id, name FROM scraping_sources LIMIT 1`,
  );
  if (sources.length > 0) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO source_pause_config (id, source_id, pause_threshold_score, pause_duration_days, auto_pause_enabled)
       VALUES ('__test__', $1, 20, 7, true)
       ON CONFLICT DO NOTHING`,
      sources[0].id,
    );
    await prisma.$executeRawUnsafe(`DELETE FROM source_pause_config WHERE id = '__test__'`);
    console.log(`\n✅ INSERT + DELETE OK — FK válida con fuente "${sources[0].name}"`);
  } else {
    console.log('\n⚠️  Sin fuentes en BD — FK no verificada (OK en BD vacía)');
  }

  console.log('\n🎉 Migration verificada correctamente\n');
  await prisma.$disconnect();
}

check().catch((e) => {
  console.error('\n❌ Error:', e.message);
  process.exit(1);
});
