import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
prisma.sourceHealth.findUnique({ where: { source: 'banrepcultural.org' } })
  .then(h => { console.log(JSON.stringify(h, null, 2)); return prisma.$disconnect(); })
  .catch(console.error);
