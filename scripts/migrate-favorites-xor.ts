// =============================================================================
// migrate-favorites-xor.ts
//
// Añade CHECK constraint XOR a la tabla favorites para garantizar integridad
// referencial a nivel de BD: cada fila debe tener EXACTAMENTE uno de
// activityId o locationId — nunca ambos, nunca ninguno.
//
// Por qué es necesario:
//   Los unique indexes (userId, activityId) y (userId, locationId) previenen
//   duplicados, pero no impiden una fila con ambas FKs simultáneas o con
//   ninguna. Sin este constraint, la integridad depende exclusivamente del
//   código de aplicación.
//
// Seguridad en datos existentes:
//   Antes de la migración S49, activityId era NOT NULL → todos los favorites
//   existentes tienen activityId IS NOT NULL y locationId IS NULL → cumplen
//   el XOR. La constraint no romperá filas existentes.
//
// Ejecutar:
//   npx tsx scripts/migrate-favorites-xor.ts
// =============================================================================

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Verificando filas que violarían el XOR antes de aplicar...');

  const violations = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*) AS count FROM "favorites"
    WHERE NOT (
      ("activityId" IS NOT NULL AND "locationId" IS NULL) OR
      ("activityId" IS NULL     AND "locationId" IS NOT NULL)
    )
  `);

  const violationCount = Number(violations[0]?.count ?? 0);
  if (violationCount > 0) {
    console.error(`❌ Abortando: ${violationCount} filas violarían el CHECK constraint.`);
    console.error('   Revisar manualmente con:');
    console.error('   SELECT * FROM favorites WHERE NOT (');
    console.error('     ("activityId" IS NOT NULL AND "locationId" IS NULL) OR');
    console.error('     ("activityId" IS NULL AND "locationId" IS NOT NULL));');
    process.exit(1);
  }

  console.log(`✅ 0 violaciones — todas las filas existentes cumplen el XOR.`);
  console.log('Aplicando CHECK constraint...');

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "favorites"
      ADD CONSTRAINT "favorites_xor_check"
      CHECK (
        ("activityId" IS NOT NULL AND "locationId" IS NULL) OR
        ("activityId" IS NULL     AND "locationId" IS NOT NULL)
      )
    `);
    console.log('✅ CHECK constraint favorites_xor_check aplicado.');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('already exists')) {
      console.log('ℹ️  El constraint ya existe — no hay nada que hacer.');
    } else {
      console.error(`❌ Error: ${msg}`);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
