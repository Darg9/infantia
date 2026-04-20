import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

async function run() {
  try {
    console.log("Intentando conectar a BD...");
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    const prisma = new PrismaClient({ adapter });

    // 1. Obtener IDs
    const arteYCreatividad = await prisma.category.findFirst({ where: { slug: 'arte-y-creatividad' } });
    const artesMarciales = await prisma.category.findFirst({ where: { slug: 'artes-marciales' } });

    if (!arteYCreatividad || !artesMarciales) {
      console.log("No se encontraron as categorías base.");
      return;
    }

    // 2. Fetch false positives
    const activitiesToMove = await prisma.activity.findMany({
      where: {
        categories: { some: { categoryId: artesMarciales.id } },
        NOT: [
          { title: { contains: 'karate', mode: 'insensitive' } },
          { title: { contains: 'judo', mode: 'insensitive' } },
          { title: { contains: 'jiu', mode: 'insensitive' } },
          { title: { contains: 'tae', mode: 'insensitive' } },
          { title: { contains: 'box', mode: 'insensitive' } },
          { title: { contains: 'artes marciales', mode: 'insensitive' } }
        ]
      },
      take: 500
    });

    console.log(`Encontradas ${activitiesToMove.length} falsos positivos en Artes Marciales.`);

    if (activitiesToMove.length > 0) {
      /*
      // UPDATE process
      for (const act of activitiesToMove) {
        await prisma.activityCategory.deleteMany({
          where: { activityId: act.id, categoryId: artesMarciales.id }
        });
        await prisma.activityCategory.upsert({
          where: { activityId_categoryId: { activityId: act.id, categoryId: arteYCreatividad.id } },
          create: { activityId: act.id, categoryId: arteYCreatividad.id },
          update: {}
        });
      }
      */
      console.log("Update process simulated.");
    }
  } catch (error) {
    console.error("Failed:", error);
  }
}

run();
