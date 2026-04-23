import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Forzamos la conexión directa a la BD quitando el pgbouncer para evitar ECONNREFUSED
const directUrl = process.env.DATABASE_URL!.replace('6543', '5432').replace('?pgbouncer=true', '');
const adapter = new PrismaPg({ connectionString: directUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const ONE_HOUR_AGO = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const totalBiblored = await prisma.activity.count({
    where: {
      sourceUrl: { contains: 'biblored' },
      createdAt: { gte: ONE_HOUR_AGO }
    }
  });

  console.log(`\n📊 Reporte Rápido: BibloRed (Últimas 2 Horas)`);
  console.log(`- Actividades guardadas en BD: ${totalBiblored}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
