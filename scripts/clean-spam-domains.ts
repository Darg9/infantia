import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Dominios que NUNCA deben ser fuente válida de actividades
const SPAM_DOMAINS = [
  'agenciadigitalamd.com',    // agencia de marketing
  'api.whatsapp.com',         // mensajería
  'whatsapp.com',             // mensajería
  'linkedin.com',             // red profesional
  'youtube.com',              // plataforma de video
  'twitter.com',              // red social
  'facebook.com',             // red social
];

async function main() {
  let totalDeleted = 0;
  for (const domain of SPAM_DOMAINS) {
    const result = await prisma.activity.deleteMany({
      where: { sourceDomain: domain }
    });
    if (result.count > 0) {
      console.log(`[OK] Eliminadas ${result.count} actividades de ${domain}`);
      totalDeleted += result.count;
    }
  }
  console.log(`\nTotal eliminadas: ${totalDeleted}`);
}

main().finally(() => prisma.$disconnect());
