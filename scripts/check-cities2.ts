import { prisma } from '../src/lib/db';

async function main() {
  const cities = await prisma.city.findMany({
    include: {
      _count: {
        select: { locations: true }
      }
    }
  });
  
  for (const city of cities) {
    const activityCount = await prisma.activity.count({
      where: {
        status: 'ACTIVE',
        location: { cityId: city.id }
      }
    });
    console.log(`${city.name}: ${activityCount} actividades activas, ${city._count.locations} locations`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
