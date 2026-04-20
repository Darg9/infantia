import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

// =============================================================================
// Desactivar actividades que son ruido NLP (páginas institucionales,
// catálogos editoriales, captchas, invitaciones de WhatsApp, etc.)
//
// NO borra nada — marca status = 'EXPIRED' para que desaparezcan del portal
// sin perder los datos para análisis futuro.
//
// Uso:
//   npx tsx scripts/deactivate-nlp-noise.ts [--dry-run]
// =============================================================================

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const isDryRun = process.argv.includes('--dry-run');

// Dominios cuyo contenido completo es ruido (catálogos, librerías, bots)
const FULL_DOMAIN_NOISE = [
  'api.whatsapp.com',
  'fce.com.co',
  'youtube.com',
  'linkedin.com',
];

// banrepcultural.org tiene mezcla: eventos reales + captchas. Filtrar por título específico.
const BANREP_NOISE_TITLES = ['captcha', 'bot manager'];


// Keywords de título que identifican páginas institucionales (no eventos)
const TITLE_NOISE_KEYWORDS = [
  'noticia', 'noticias', 'gestión pública', 'gestion publica',
  'hábitat en bogotá', 'habitat en bogota',
  'movilidad en bogotá', 'movilidad en bogota',
  'educación en bogotá', 'educacion en bogota',
  'mujer en bogotá', 'mujer en bogota',
  'medio ambiente bogotá', 'medio ambiente bogota',
  'salud en bogotá', 'salud en bogota',
  'integración social', 'integracion social',
  'gobierno abierto', 'plan de ordenamiento',
  'mantenimiento vial', 'internacional de bogotá',
  'desarrollo económico', 'desarrollo economico',
  'monserrate', 'caminatas ecológicas', 'caminatas ecologicas',
  'jurídica en bogotá', 'juridica en bogota',
  'logra premio', 'web awards',
  'consejería de relaciones', 'consejeria de relaciones',
  'directorio institucional', 'organigrama',
  'subsidiarias', 'tienda-libreria', 'tienda librería', 'portafolio de servicios',
  'distribuidora', 'boletines', 'cómo publicar', 'como publicar',
  'siglo del hombre editores', 'términos y condiciones', 'terminos y condiciones',
  'pqrs', 'tratamiento de datos personales', 'varios autores',
  'áreas disponibles', 'areas disponibles',
  'bot manager captcha', 'captcha',
  'comprar libros', 'libros de ciencias sociales',
];

async function main() {
  console.log(`\n🧹 Desactivar Ruido NLP`);
  console.log(`Modo: ${isDryRun ? '🔍 DRY RUN' : '💾 GUARDAR EN BD'}\n`);

  // ── 1. Dominios de ruido completo ─────────────────────────────────────────
  const domainNoiseCandidates = await prisma.activity.findMany({
    where: {
      status: 'ACTIVE',
      OR: FULL_DOMAIN_NOISE.map(d => ({ sourceUrl: { contains: d, mode: 'insensitive' as const } })),
    },
    select: { id: true, title: true, sourceUrl: true }
  });

  console.log(`📡 Ruido por dominio completo: ${domainNoiseCandidates.length}`);
  domainNoiseCandidates.forEach(a => console.log(`  • [${a.sourceUrl?.split('/')[2]}] ${a.title}`));

  // banrepcultural.org — solo desactivar captchas, preservar eventos reales
  const banrepAll = await prisma.activity.findMany({
    where: { status: 'ACTIVE', sourceUrl: { contains: 'banrepcultural.org', mode: 'insensitive' } },
    select: { id: true, title: true, sourceUrl: true, locationId: true }
  });
  const banrepNoise = banrepAll.filter(a =>
    BANREP_NOISE_TITLES.some(kw => a.title.toLowerCase().includes(kw.toLowerCase()))
  );
  const banrepReal = banrepAll.filter(a =>
    !BANREP_NOISE_TITLES.some(kw => a.title.toLowerCase().includes(kw.toLowerCase()))
  );
  console.log(`\n🏛️  banrepcultural.org — ${banrepNoise.length} captchas (PURGAR) + ${banrepReal.length} eventos reales (PRESERVAR + geolocali)`);
  banrepNoise.forEach(a => console.log(`  🗑️  "${a.title}"`));
  banrepReal.forEach(a => console.log(`  ✅ "${a.title}"`));

  // ── 2. Páginas institucionales por título ─────────────────────────────────
  const allActiveNoLoc = await prisma.activity.findMany({
    where: {
      status: 'ACTIVE',
      locationId: null,
      sourceUrl: { not: null },
    },
    select: { id: true, title: true, sourceUrl: true }
  });

  const titleNoiseCandidates = allActiveNoLoc.filter(a =>
    TITLE_NOISE_KEYWORDS.some(kw => a.title.toLowerCase().includes(kw.toLowerCase()))
    && !domainNoiseCandidates.find(d => d.id === a.id) // no duplicar
  );

  console.log(`\n📝 Ruido por título (páginas institucionales): ${titleNoiseCandidates.length}`);
  titleNoiseCandidates.forEach(a => console.log(`  • "${a.title}"`));

  // ── 3. Ejecutar ───────────────────────────────────────────────────────────
  const allToDeactivateIds = [...new Set([
    ...domainNoiseCandidates.map(a => a.id),
    ...banrepNoise.map(a => a.id),
    ...titleNoiseCandidates.map(a => a.id),
  ])];

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total a desactivar: ${allToDeactivateIds.length}`);

  if (!isDryRun) {
    if (allToDeactivateIds.length > 0) {
      const result = await prisma.activity.updateMany({
        where: { id: { in: allToDeactivateIds } },
        data: { status: 'EXPIRED' }
      });
      console.log(`  ✅ ${result.count} actividades marcadas como EXPIRED`);
    }

    // Geocodificar los eventos reales del Banco de la República
    if (banrepReal.length > 0) {
      const bogota = await prisma.city.findFirst({ where: { name: { contains: 'Bogot', mode: 'insensitive' } } });
      if (bogota) {
        let banrepLoc = await prisma.location.findFirst({
          where: { cityId: bogota.id, name: { contains: 'Banco de la Rep', mode: 'insensitive' } }
        });
        if (!banrepLoc) {
          banrepLoc = await prisma.location.create({
            data: { name: 'Banco de la República', address: 'Banco de la República', cityId: bogota.id, latitude: 0, longitude: 0 }
          });
          console.log(`  ✨ Creada Location: "Banco de la República"`);
        }
        const toGeolocate = banrepReal.filter(a => !a.locationId);
        if (toGeolocate.length > 0) {
          await prisma.activity.updateMany({
            where: { id: { in: toGeolocate.map(a => a.id) } },
            data: { locationId: banrepLoc.id }
          });
          console.log(`  📍 ${toGeolocate.length} eventos del Banco de la República → Bogotá`);
        }
      }
    }
  }


  // ── 4. Cobertura final ────────────────────────────────────────────────────
  const [withLoc, withoutLoc] = await Promise.all([
    prisma.activity.count({ where: { status: 'ACTIVE', locationId: { not: null } } }),
    prisma.activity.count({ where: { status: 'ACTIVE', locationId: null } }),
  ]);
  const total = withLoc + withoutLoc;
  const pct = total > 0 ? ((withLoc / total) * 100).toFixed(1) : '0';
  console.log(`\n📈 Cobertura ${isDryRun ? '(sin cambios)' : 'post-limpieza'}:`);
  console.log(`   coverage_pct = ${pct}% (${withLoc}/${total} activas con location)`);

  // ── 5. Top 10 dominios restantes sin location ─────────────────────────────
  const remaining = await prisma.$queryRaw<{ domain: string; cnt: bigint }[]>`
    SELECT
      SPLIT_PART(REGEXP_REPLACE("sourceUrl", '^https?://(www\.)?', ''), '/', 1) AS domain,
      COUNT(*) as cnt
    FROM activities
    WHERE "locationId" IS NULL AND status = 'ACTIVE'
    GROUP BY domain ORDER BY cnt DESC LIMIT 10;
  `;
  console.log(`\n🔍 Top dominios restantes sin location:`);
  remaining.forEach(r => console.log(`  ${String(r.cnt).padStart(4)}  ${r.domain}`));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
