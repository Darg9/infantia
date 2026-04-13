import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import "dotenv/config";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando migración Raw SQL idempotente para SourceHealth...');

  // Injecting table to surpass PgBouncer limitations entirely.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS source_health (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source text UNIQUE NOT NULL,
      success_count integer DEFAULT 0,
      error_count integer DEFAULT 0,
      last_success_at timestamptz,
      last_error_at timestamptz,
      avg_response_ms integer DEFAULT 0,
      score double precision DEFAULT 1.0,
      status text DEFAULT 'healthy',
      updated_at timestamptz DEFAULT now()
    );
  `);

  console.log('✅ Tabla source_health verificada/creada exitosamente.');
}

main()
  .catch((e) => {
    console.error('Error migrando:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
