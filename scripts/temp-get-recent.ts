import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60000);
  const activities = await prisma.activity.findMany({
    where: { 
      createdAt: { gte: thirtyMinsAgo }
    },
    select: {
      sourceUrl: true,
      sourceDomain: true,
      title: true,
      description: true,
      price: true,
      startDate: true,
      location: { select: { name: true } }
    }
  });

  if (activities.length === 0) {
    console.log('No activities found in the last 30 minutes.');
  }

  for (const act of activities) {
    console.log('\n========================================');
    console.log('🔗 URL:        ', act.sourceUrl);
    console.log('📍 Dominio:    ', act.sourceDomain);
    console.log('📌 Título:     ', act.title);
    console.log('📅 Fecha:      ', act.startDate);
    console.log('🏛️  Lugar:      ', act.location?.name || 'N/A');
    console.log('💵 Precio:     ', act.price);
    console.log('📝 Desc:       ', act.description);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
