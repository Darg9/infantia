// scripts/setup-pipeline-v2.ts
// Crea las tablas y enum values necesarios para el Pipeline V2.
// Uso: npx tsx scripts/setup-pipeline-v2.ts

import 'dotenv/config';
import { prisma } from '../src/lib/db';

async function main() {
  console.log('🚀 Configurando Pipeline V2...\n');

  // 1. Enum PENDING_REVIEW
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "ActivityStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW'`,
    );
    console.log('✅ PENDING_REVIEW añadido al enum ActivityStatus');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('ℹ️  Enum (ya existe o error):', msg);
  }

  // 2. source_learning — trust score dinámico por fuente
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS source_learning (
      id              BIGSERIAL     PRIMARY KEY,
      source          VARCHAR(255)  NOT NULL UNIQUE,
      is_institutional BOOLEAN      NOT NULL DEFAULT false,
      approved        INT           NOT NULL DEFAULT 0,
      rejected        INT           NOT NULL DEFAULT 0,
      trust_score     FLOAT         NOT NULL DEFAULT 0.5,
      threshold       FLOAT         NOT NULL DEFAULT 0.40,
      last_updated    TIMESTAMPTZ   NOT NULL DEFAULT now()
    )
  `);
  console.log('✅ source_learning creada (o ya existía)');

  // 3. review_decisions — historial de decisiones editoriales
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS review_decisions (
      id              BIGSERIAL     PRIMARY KEY,
      activity_id     VARCHAR(36)   NOT NULL,
      source          VARCHAR(255)  NOT NULL,
      is_institutional BOOLEAN      NOT NULL DEFAULT false,
      gate_score      FLOAT,
      gate_reason     VARCHAR(255),
      gate_signals    JSONB,
      source_trust    FLOAT,
      decision        VARCHAR(20),
      decision_reason VARCHAR(500),
      reviewed_at     TIMESTAMPTZ,
      reviewed_by     VARCHAR(255),
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_rd_activity ON review_decisions(activity_id)`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_rd_source ON review_decisions(source)`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_rd_decision ON review_decisions(decision)`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_rd_created ON review_decisions(created_at DESC)`,
  );
  console.log('✅ review_decisions creada (o ya existía)');

  console.log('\n✅ Pipeline V2 — setup completado.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
