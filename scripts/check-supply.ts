import { prisma } from '../src/lib/db';

async function main() {
  try {
    const total = await prisma.activity.count();
    const active = await prisma.activity.count({ where: { status: 'ACTIVE' } });
    const paused = await prisma.activity.count({ where: { status: 'PAUSED' } });
    const expired = await prisma.activity.count({ where: { status: 'EXPIRED' } });
    
    console.log(`Total: ${total}`);
    console.log(`Active: ${active}`);
    console.log(`Paused: ${paused}`);
    console.log(`Expired: ${expired}`);

    const pqrs = await prisma.contactRequest.count();
    console.log(`PQRS totales: ${pqrs}`);
  } catch (e) {
    console.error('Fallo de conexión:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
