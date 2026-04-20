import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SOURCE_PATH_ALLOWLIST: { domain: string; allowed: string[] }[] = [
  { domain: 'bogota.gov.co', allowed: ['/que-hacer/agenda-cultural'] },
  { domain: 'biblored.gov.co', allowed: ['/eventos'] },
  { domain: 'idartes.gov.co', allowed: ['/es/agenda'] },
  { domain: 'jbb.gov.co', allowed: ['/eventos'] },
  { domain: 'planetariodebogota.gov.co', allowed: ['/programate'] },
  { domain: 'cinematecadebogota.gov.co', allowed: ['/agenda', '/cine'] },
];

async function main() {
  console.log('Iniciando limpieza de ruido institucional en dominios protegidos...');
  let totalDeleted = 0;

  for (const rule of SOURCE_PATH_ALLOWLIST) {
    // 1. Encontrar todas las actividades de este dominio
    const activities = await prisma.activity.findMany({
      where: { sourceDomain: rule.domain },
      select: { id: true, sourceUrl: true, title: true }
    });

    console.log(`\nRevisando ${rule.domain} (Encontradas: ${activities.length})`);
    
    // 2. Filtrar las que NO cumplen la regla de allowed paths
    const toDelete = activities.filter(act => {
      if (!act.sourceUrl) return true; // sin url = basico borrarlo
      try {
        const urlObj = new URL(act.sourceUrl);
        const path = urlObj.pathname;
        const isAllowed = rule.allowed.some(a => path.startsWith(a));
        return !isAllowed;
      } catch {
        return true;
      }
    });

    if (toDelete.length > 0) {
        console.log(`Borrando ${toDelete.length} URLs prohibidas de ${rule.domain}:`);
        toDelete.slice(0, 5).forEach(act => console.log(` - ${act.sourceUrl} (${act.title})`));
        if (toDelete.length > 5) console.log(` - ...y ${toDelete.length - 5} más.`);

        const idsToDelete = toDelete.map(a => a.id);
        
        await prisma.activity.deleteMany({
            where: { id: { in: idsToDelete } }
        });
        
        totalDeleted += toDelete.length;
    } else {
        console.log(`Todo limpio para ${rule.domain}.`);
    }
  }

  console.log(`\nLimpieza terminada. Se eliminaron ${totalDeleted} ruidos institucionales.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
