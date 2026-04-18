// migrate-ingest-metrics.ts — Crea tabla ingest_metrics para métricas por ejecución
//
// Ejecutar:
//   npx tsx scripts/migrate-ingest-metrics.ts

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Creando tabla ingest_metrics...');

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ingest_metrics" (
        "id"             SERIAL PRIMARY KEY,
        "source_id"      TEXT        NOT NULL,
        "source_name"    TEXT        NOT NULL,
        "channel"        TEXT        NOT NULL,
        "run_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "posts_detected" INT         NOT NULL DEFAULT 0,
        "posts_parsed"   INT         NOT NULL DEFAULT 0,
        "posts_failed"   INT         NOT NULL DEFAULT 0,
        "error_type"     TEXT        -- NULL=éxito | quota | parse | network
      )
    `);
    console.log('✅ Tabla ingest_metrics creada (o ya existía).');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ingest_metrics_source_id_idx" ON "ingest_metrics" ("source_id");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ingest_metrics_run_at_idx" ON "ingest_metrics" ("run_at" DESC);
    `);
    console.log('✅ Índices creados.');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error: ${msg}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
