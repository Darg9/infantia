import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const act = await prisma.activity.findUnique({
    where: { id: '6d134b0e-97e1-4539-ab5d-0a5cda099d1d' },
    select: { 
        id: true, 
        title: true, 
        sourceUrl: true, 
        sourceDomain: true, 
        sourcePlatform: true,
        provider: { select: { name: true } },
        createdAt: true 
    }
  });
  console.log(act);
}

main().finally(() => prisma.$disconnect());
