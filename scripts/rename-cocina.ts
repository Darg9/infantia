import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.category.updateMany({
    where: { name: { contains: 'Cocina', mode: 'insensitive' } },
    data: { name: 'Cocina', slug: 'cocina' }
  });
  console.log(`Categorías actualizadas: ${result.count}`);

  // Verificar el resultado
  const cats = await prisma.category.findMany({
    where: { name: { contains: 'cocina', mode: 'insensitive' } },
    select: { id: true, name: true, slug: true }
  });
  console.log('Categorías de cocina:', cats);
}

main().finally(() => prisma.$disconnect());
