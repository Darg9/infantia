import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const activities = await prisma.activity.findMany({
    where: { status: 'ACTIVE' },
    select: { title: true, sourceDomain: true, sourceUrl: true },
    orderBy: [
      { sourceDomain: 'asc' },
      { title: 'asc' }
    ]
  });

  const grouped: Record<string, string[]> = {};
  for (const act of activities) {
    const domain = act.sourceDomain || 'Desconocido';
    if (!grouped[domain]) grouped[domain] = [];
    grouped[domain].push(`- [${act.title}](${act.sourceUrl})`);
  }

  let markdown = "# URLs de Fuentes Activas (95 Actividades)\n\n";

  for (const domain of Object.keys(grouped)) {
    markdown += `\n## ${domain} (${grouped[domain].length})\n`;
    markdown += grouped[domain].join('\n') + '\n';
  }

  const fs = require('fs');
  const path = require('path');
  const outputPath = path.join(process.cwd(), 'active_sources.md');
  fs.writeFileSync(outputPath, markdown);
  console.log('Listado generado en', outputPath);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
