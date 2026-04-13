import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import "dotenv/config";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando migración para source_domain en DB...');

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE activities
      ADD COLUMN IF NOT EXISTS source_domain TEXT;
    `);
    console.log('✅ Columna source_domain inicializada.');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS activities_source_domain_idx ON activities(source_domain);
    `);
    console.log('✅ Indice sobre source_domain establecido.');
  } catch (error: any) {
    console.error(`❌ Fallo corriendo Raw SQL: ${error.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
