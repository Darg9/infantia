import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import "dotenv/config";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Patching Events table with metadata...');

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS metadata JSONB;
    `);
    console.log('✅ Metadata JSONB adicionada con exito.');
  } catch (error: any) {
    console.error(`❌ Fallo corriendo Raw SQL: ${error.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
