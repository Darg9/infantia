import { prisma } from '../src/lib/db';

async function main() {
  const updates = [
    { where: { website: 'https://biblored.gov.co' }, name: 'BibloRed' },
    { where: { website: 'https://bogota.gov.co' }, name: 'Alcaldía de Bogotá' },
    { where: { website: 'https://culturarecreacionydeporte.gov.co' }, name: 'Sec. de Cultura, Recreación y Deporte' },
    { where: { instagram: 'fcecolombia' }, name: 'FCE Colombia' },
    { where: { instagram: 'quehaypahacerenbogota' }, name: '¿Qué hay pa hacer en Bogotá?' },
  ];

  for (const u of updates) {
    const r = await prisma.provider.updateMany({ where: u.where, data: { name: u.name } });
    console.log(`${u.name} → ${r.count} updated`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
