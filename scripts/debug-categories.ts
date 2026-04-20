import { prisma } from '../src/lib/db';

async function run() {
  const categories = await prisma.category.findMany({
    where: { slug: 'artes-marciales' },
    include: {
      activities: {
        include: { activity: true }
      }
    }
  });

  if (categories.length === 0) {
    console.log("No existe la categoria artes-marciales");
    return;
  }

  const category = categories[0];
  console.log(`Total actividades en ${category.name}: ${category.activities.length}`);

  console.log("\nMuestra de actividades:");
  for (const ac of category.activities.slice(0, 5)) {
    console.log(`- ${ac.activity.title} (Source: ${ac.activity.sourceUrl}) (Created: ${ac.activity.createdAt.toISOString()})`);
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
