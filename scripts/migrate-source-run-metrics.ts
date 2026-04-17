/**
 * migrate-source-run-metrics.ts
 *
 * Crea la tabla source_run_metrics para trazabilidad transversal del pipeline.
 *
 * Uso: npx tsx scripts/migrate-source-run-metrics.ts
 *
 * Permite responder: "BibloRed scrapeó 80 URLs ayer. ¿Por qué guardamos 3?"
 * Con un solo SELECT por (source_id, run_at).
 *
 * Retención recomendada: 90 días.
 * Limpieza: DELETE FROM source_run_metrics WHERE created_at < now() - interval '90 days';
 *
 * Nota: source_id es TEXT (no UUID nativo) — ScrapingSource.id usa @default(uuid())
 * almacenado como texto en PostgreSQL.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter } as any);

async function main() {
  console.log('📊 Creando tabla source_run_metrics...');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "source_run_metrics" (
      "id"                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      "source_id"            TEXT        NOT NULL,
      "run_at"               TIMESTAMPTZ NOT NULL DEFAULT now(),
      "urls_scraped"         INT         NOT NULL DEFAULT 0,
      "urls_after_preflight" INT         NOT NULL DEFAULT 0,
      "gemini_ok"            INT         NOT NULL DEFAULT 0,
      "fallback_count"       INT         NOT NULL DEFAULT 0,
      "activities_saved"     INT         NOT NULL DEFAULT 0,
      "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log('✅ Tabla source_run_metrics creada.');

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "srm_source_id_idx"
      ON "source_run_metrics" ("source_id")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "srm_run_at_idx"
      ON "source_run_metrics" ("run_at" DESC)
  `);
  console.log('✅ Índices creados (source_id, run_at DESC).');

  console.log('');
  console.log('Queries de análisis:');
  console.log('');
  console.log('  -- Funnel completo por fuente (últimos 7 días)');
  console.log('  SELECT source_id,');
  console.log('    SUM(urls_scraped)         AS scraped,');
  console.log('    SUM(urls_after_preflight) AS after_preflight,');
  console.log('    SUM(gemini_ok)            AS gemini_ok,');
  console.log('    SUM(fallback_count)       AS fallback,');
  console.log('    SUM(activities_saved)     AS saved');
  console.log('  FROM source_run_metrics');
  console.log('  WHERE run_at >= now() - interval \'7 days\'');
  console.log('  GROUP BY source_id ORDER BY saved DESC;');
  console.log('');
  console.log('  -- Degradación en el tiempo para una fuente');
  console.log('  SELECT run_at::date, activities_saved, gemini_ok, fallback_count');
  console.log('  FROM source_run_metrics');
  console.log('  WHERE source_id = \'<id>\'');
  console.log('  ORDER BY run_at DESC LIMIT 30;');
}

main()
  .catch((err) => { console.error('❌ Error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
