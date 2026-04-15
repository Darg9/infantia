/**
 * Migration: Habilitar pg_trgm y crear índices GIN para búsqueda por similitud
 *
 * Ejecutar: npx tsx scripts/migrate-trgm.ts
 *
 * Qué hace:
 *   1. Habilita la extensión pg_trgm en Supabase (idempotente)
 *   2. Crea índices GIN sobre activities.title y activities.description
 *   3. Crea índice GIN sobre categories.name (para el autocomplete)
 *
 * Idempotente: puede ejecutarse múltiples veces sin error.
 * pgbouncer-safe: solo DDL, no usa transacciones interactivas.
 */

import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { createLogger } from '../src/lib/logger';

const log = createLogger('migrate:trgm');

async function migrate() {
  log.info('Iniciando migración pg_trgm...');

  // ── 1. Habilitar extensión ────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  `);
  log.info('Extensión pg_trgm habilitada');

  // ── 2. Índice GIN en activities.title ─────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_title_trgm
    ON activities
    USING gin (title gin_trgm_ops);
  `);
  log.info('Índice GIN creado en activities.title');

  // ── 3. Índice GIN en activities.description ───────────────────────────────
  // Se limita a los primeros 500 chars para reducir tamaño del índice
  await prisma.$executeRawUnsafe(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_desc_trgm
    ON activities
    USING gin (left(description, 500) gin_trgm_ops);
  `);
  log.info('Índice GIN creado en activities.description (primeros 500 chars)');

  // ── 4. Índice GIN en categories.name (suggestions) ───────────────────────
  await prisma.$executeRawUnsafe(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_name_trgm
    ON categories
    USING gin (name gin_trgm_ops);
  `);
  log.info('Índice GIN creado en categories.name');

  // ── 5. Verificar ─────────────────────────────────────────────────────────
  const indexes = await prisma.$queryRaw<{ indexname: string; tablename: string }[]>`
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE indexname LIKE '%trgm%'
    ORDER BY tablename, indexname;
  `;

  log.info(`Índices trgm existentes: ${indexes.length}`);
  for (const idx of indexes) {
    log.info(`  ✅ ${idx.tablename}.${idx.indexname}`);
  }

  log.info('Migración pg_trgm completada');
}

migrate()
  .catch((e) => {
    console.error('Error en migración:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
