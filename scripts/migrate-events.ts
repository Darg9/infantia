import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import "dotenv/config";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando migración DDL para la tabla de Analitycs (Events)...');

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "events" (
        "id" TEXT NOT NULL,
        "type" VARCHAR(100) NOT NULL,
        "activityId" VARCHAR(255),
        "path" TEXT,
        "userAgent" TEXT,
        "ip" VARCHAR(50),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "events_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('✅ Tabla events inicializada.');

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "events_type_idx" ON "events"("type");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "events_activityId_idx" ON "events"("activityId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "events_createdAt_idx" ON "events"("createdAt");`);
    
    console.log('✅ Indices de events establecidos.');
  } catch (error: any) {
    console.error(`❌ Fallo corriendo Raw SQL: ${error.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
