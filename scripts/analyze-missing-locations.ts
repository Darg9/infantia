import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Agrupado por dominio
  const byDomain = await prisma.$queryRaw<{ domain: string; count: bigint }[]>`
    SELECT
      SPLIT_PART(REGEXP_REPLACE("sourceUrl", '^https?://(www\.)?', ''), '/', 1) AS domain,
      COUNT(*) as count
    FROM activities
    WHERE "locationId" IS NULL
      AND "sourceUrl" IS NOT NULL
      AND status = 'ACTIVE'
    GROUP BY domain
    ORDER BY count DESC
    LIMIT 20;
  `;

  console.log('\n📊 TOP DOMINIOS — Actividades sin location\n');
  byDomain.forEach(r => console.log(`  ${String(r.count).padStart(4)}  ${r.domain}`));

  // 2. Handles de Instagram sin location
  const byInsta = await prisma.$queryRaw<{ handle: string; count: bigint }[]>`
    SELECT
      SUBSTRING("sourceUrl" FROM 'instagram\.com/([^/?]+)') AS handle,
      COUNT(*) as count
    FROM activities
    WHERE "locationId" IS NULL
      AND status = 'ACTIVE'
      AND "sourceUrl" ILIKE '%instagram.com%'
    GROUP BY handle
    ORDER BY count DESC
    LIMIT 20;
  `;

  console.log('\n📸 HANDLES INSTAGRAM — Sin location\n');
  byInsta.forEach(r => console.log(`  ${String(r.count).padStart(4)}  instagram.com/${r.handle}`));

  // 3. Providers con location propia (potencial herencia)
  const providerLocations = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM activities a
    JOIN providers p ON p.id = a."providerId"
    JOIN provider_locations pl ON pl."providerId" = p.id
    WHERE a."locationId" IS NULL
      AND a.status = 'ACTIVE';
  `;
  console.log(`\n🏢 Actividades sin location cuyo provider tiene location: ${providerLocations[0]?.count ?? 0}`);

  // 4. Muestra de títulos potencialmente basura
  const noise = await prisma.$queryRaw<{ title: string; sourceUrl: string }[]>`
    SELECT title, "sourceUrl"
    FROM activities
    WHERE "locationId" IS NULL
      AND status = 'ACTIVE'
      AND (
        title ILIKE '%noticia%' OR
        title ILIKE '%premio%' OR
        title ILIKE '%comunicado%' OR
        title ILIKE '%directorio%' OR
        title ILIKE '%bienvenido%' OR
        title ILIKE '%organigrama%' OR
        title ILIKE '%estratégico%' OR
        title ILIKE '%gerencia%'
      )
    LIMIT 30;
  `;

  console.log(`\n🗑️  Posible basura/ruido NLP (${noise.length} encontrados):\n`);
  noise.forEach(r => console.log(`  • ${r.title}`));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
