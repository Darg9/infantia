/**
 * migrate-city-review-queue.ts
 *
 * Crea la tabla city_review_queue para revisión humana de ciudades
 * con baja confianza en el matching canónico.
 *
 * Uso: npx tsx scripts/migrate-city-review-queue.ts
 *
 * Campos:
 *   raw_input        — nombre original del scraper
 *   normalized_input — nombre normalizado (sin tildes, lowercase)
 *   suggested_city_id — mejor ciudad sugerida por Levenshtein (puede ser null)
 *   similarity_score — score 0.0–1.0
 *   resolved         — true cuando un admin lo resuelve manualmente
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🏙️  Creando tabla city_review_queue...');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "city_review_queue" (
      "id"               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
      "raw_input"        VARCHAR(200) NOT NULL,
      "normalized_input" VARCHAR(200) NOT NULL,
      "suggested_city_id" TEXT   REFERENCES "cities"("id") ON DELETE SET NULL,
      "similarity_score" FLOAT  NOT NULL,
      "resolved"         BOOLEAN NOT NULL DEFAULT false,
      "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "city_review_queue_created_at_idx"
      ON "city_review_queue" ("created_at" DESC)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "city_review_queue_resolved_idx"
      ON "city_review_queue" ("resolved")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "city_review_queue_score_idx"
      ON "city_review_queue" ("similarity_score")
  `);

  console.log('✅ Tabla city_review_queue creada con 3 índices.');
  console.log('');
  console.log('Queries de monitoreo:');
  console.log('  -- Pendientes de revisión');
  console.log('  SELECT raw_input, normalized_input, similarity_score');
  console.log('  FROM city_review_queue WHERE resolved = false ORDER BY created_at DESC;');
  console.log('');
  console.log('  -- city_review_rate (últimos 7 días)');
  console.log('  SELECT');
  console.log('    COUNT(*) FILTER (WHERE similarity_score >= 0.9)  AS auto_matched,');
  console.log('    COUNT(*) FILTER (WHERE similarity_score >= 0.75 AND similarity_score < 0.9) AS review,');
  console.log('    COUNT(*) FILTER (WHERE similarity_score < 0.75)  AS unknown');
  console.log('  FROM city_review_queue');
  console.log('  WHERE created_at >= now() - interval \'7 days\';');
}

main()
  .catch((err) => { console.error('❌ Error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
