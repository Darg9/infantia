// =============================================================================
// migrate-favorites-polymorphic.ts
//
// Aplica el esquema polimórfico completo a la tabla "favorites":
//   - Añade columna "id" (TEXT, PK única) si no existe
//   - Rellena "id" con gen_random_uuid() en filas existentes
//   - Elimina PK compuesta (userId, activityId) y sustituye por id
//   - Añade columna "locationId" (TEXT nullable, FK → locations.id)
//   - Hace "activityId" nullable (DROP NOT NULL)
//   - Crea índices únicos (userId, activityId) y (userId, locationId)
//   - Añade FK favorites_locationId_fkey
//   - Añade CHECK constraint XOR (exactamente uno de activityId / locationId)
//
// Idempotente: cada paso verifica si ya existe antes de aplicar.
//
// Ejecutar:
//   npx tsx scripts/migrate-favorites-polymorphic.ts
// =============================================================================

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ count: string }[]>(
    `SELECT COUNT(*)::text AS count
     FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2`,
    table,
    column,
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function constraintExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ count: string }[]>(
    `SELECT COUNT(*)::text AS count FROM pg_constraint WHERE conname = $1`,
    name,
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function indexExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ count: string }[]>(
    `SELECT COUNT(*)::text AS count FROM pg_indexes WHERE indexname = $1`,
    name,
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function main() {
  console.log('🔍 Verificando estado actual de la tabla favorites...\n');

  const hasId = await columnExists('favorites', 'id');
  const hasLocationId = await columnExists('favorites', 'locationId');
  const hasPkOnId = await constraintExists('favorites_pkey');
  const hasXor = await constraintExists('favorites_xor_check');
  const hasUniqueActivity = await indexExists('favorites_userId_activityId_key');
  const hasUniqueLocation = await indexExists('favorites_userId_locationId_key');

  console.log(`  id column:               ${hasId ? '✅' : '❌'}`);
  console.log(`  locationId column:       ${hasLocationId ? '✅' : '❌'}`);
  console.log(`  PK on id:                ${hasPkOnId ? '✅' : '❌'}`);
  console.log(`  unique (userId,actId):   ${hasUniqueActivity ? '✅' : '❌'}`);
  console.log(`  unique (userId,locId):   ${hasUniqueLocation ? '✅' : '❌'}`);
  console.log(`  XOR check constraint:    ${hasXor ? '✅' : '❌'}`);
  console.log('');

  // ── 1. Columna id ───────────────────────────────────────────────────────────
  if (!hasId) {
    console.log('Añadiendo columna id...');
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "favorites" ADD COLUMN IF NOT EXISTS "id" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "favorites" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "favorites" ALTER COLUMN "id" SET NOT NULL`,
    );
    console.log('✅ Columna id añadida y rellenada.');
  }

  // ── 2. Reemplazar PK compuesta por PK en id ────────────────────────────────
  if (!hasPkOnId) {
    // Verificar si la PK compuesta existe
    const hasCompositePk = await constraintExists('favorites_pkey');
    if (hasCompositePk) {
      console.log('Eliminando PK compuesta...');
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "favorites" DROP CONSTRAINT "favorites_pkey"`,
      );
    }
    console.log('Añadiendo PK en id...');
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "favorites" ADD PRIMARY KEY ("id")`,
    );
    console.log('✅ PK migrada a id.');
  }

  // ── 3. Columna locationId ──────────────────────────────────────────────────
  if (!hasLocationId) {
    console.log('Añadiendo columna locationId...');
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "favorites" ADD COLUMN IF NOT EXISTS "locationId" TEXT`,
    );
    console.log('✅ Columna locationId añadida.');
  }

  // ── 4. activityId nullable ─────────────────────────────────────────────────
  // Siempre idempotente: si ya es nullable, no hace nada
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "favorites" ALTER COLUMN "activityId" DROP NOT NULL`,
  );
  console.log('✅ activityId ahora nullable.');

  // ── 5. Índices únicos ──────────────────────────────────────────────────────
  if (!hasUniqueActivity) {
    console.log('Creando índice único (userId, activityId)...');
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "favorites_userId_activityId_key"
       ON "favorites"("userId", "activityId")`,
    );
    console.log('✅ Índice unique (userId, activityId) creado.');
  }

  if (!hasUniqueLocation) {
    console.log('Creando índice único (userId, locationId)...');
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "favorites_userId_locationId_key"
       ON "favorites"("userId", "locationId")`,
    );
    console.log('✅ Índice unique (userId, locationId) creado.');
  }

  // ── 6. FK para locationId ──────────────────────────────────────────────────
  const hasFkLocation = await constraintExists('favorites_locationId_fkey');
  if (!hasFkLocation) {
    console.log('Añadiendo FK favorites_locationId_fkey...');
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "favorites"
       ADD CONSTRAINT "favorites_locationId_fkey"
       FOREIGN KEY ("locationId") REFERENCES "locations"("id")
       ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    console.log('✅ FK favorites_locationId_fkey añadida.');
  }

  // ── 7. XOR constraint ──────────────────────────────────────────────────────
  if (!hasXor) {
    // Verificar que no haya filas que violarían el constraint
    // (activityId NULL y locationId NULL al mismo tiempo)
    const violations = await prisma.$queryRawUnsafe<{ count: string }[]>(`
      SELECT COUNT(*)::text AS count FROM "favorites"
      WHERE NOT (
        ("activityId" IS NOT NULL AND "locationId" IS NULL) OR
        ("activityId" IS NULL     AND "locationId" IS NOT NULL)
      )
    `);
    const violationCount = Number(violations[0]?.count ?? 0);
    if (violationCount > 0) {
      // Filas existentes con activityId IS NOT NULL y locationId IS NULL → ok
      // Filas con ambos NULL → corregir poniendo locationId = null ya está bien
      // Pero realmente el problema sería activityId = NULL y locationId = NULL
      // Eso no puede pasar en datos pre-S49 (activityId era NOT NULL)
      // Tras S49 podría haber inconsistencias — limpiar
      console.warn(`⚠️  ${violationCount} filas violarían el XOR. Corrigiendo...`);
      // Rows con ambas FKs NULL no deberían existir — son huérfanas, eliminar
      await prisma.$executeRawUnsafe(`
        DELETE FROM "favorites"
        WHERE "activityId" IS NULL AND "locationId" IS NULL
      `);
      console.log('✅ Filas inválidas eliminadas.');
    }

    console.log('Añadiendo CHECK constraint XOR...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "favorites"
      ADD CONSTRAINT "favorites_xor_check"
      CHECK (
        ("activityId" IS NOT NULL AND "locationId" IS NULL) OR
        ("activityId" IS NULL     AND "locationId" IS NOT NULL)
      )
    `);
    console.log('✅ CHECK constraint favorites_xor_check añadido.');
  }

  console.log('\n✅ Migración polimórfica de favorites completada.');
  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error('❌ Error durante migración:', err);
  process.exit(1);
});
