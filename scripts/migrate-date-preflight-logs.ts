import { getErrorMessage } from '../src/lib/error';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import "dotenv/config";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando migración DDL para date_preflight_logs...');

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "date_preflight_logs" (
        "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
        "source_id"      TEXT,
        "url"            TEXT        NOT NULL,
        "raw_date_text"  TEXT,
        "parsed_date"    DATE,
        "reason"         TEXT        NOT NULL,
        "used_fallback"  BOOLEAN     NOT NULL DEFAULT false,
        "skip"           BOOLEAN     NOT NULL DEFAULT false,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "date_preflight_logs_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('✅ Tabla date_preflight_logs creada.');

    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "dpl_created_at_idx"  ON "date_preflight_logs" ("created_at" DESC);`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "dpl_reason_idx"      ON "date_preflight_logs" ("reason");`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "dpl_source_id_idx"   ON "date_preflight_logs" ("source_id");`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "dpl_skip_idx"        ON "date_preflight_logs" ("skip");`
    );

    console.log('✅ Índices de date_preflight_logs establecidos.');
    console.log('');
    console.log('Vocabulario de reason (alineado con date-preflight.ts):');
    console.log('  process       → URL enviada a Gemini (= "ok" en propuesta)');
    console.log('  datetime_past → descartada por atributo datetime HTML (capa 1)');
    console.log('  text_date_past→ descartada por fecha en texto plano (capa 2)');
    console.log('  past_year_only→ descartada por años pasados sin año actual (capa 3a)');
    console.log('  keyword_past  → descartada por keyword finalizado (capa 3b)');
    console.log('');
    console.log('Retención recomendada: 14 días.');
    console.log('Limpieza manual: DELETE FROM date_preflight_logs WHERE created_at < now() - interval \'14 days\';');
  } catch (error: unknown) {
    console.error(`❌ Fallo: ${getErrorMessage(error)}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
