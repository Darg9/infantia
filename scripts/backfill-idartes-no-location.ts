import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

// =============================================================================
// Backfill puntual: Actividades de idartes.gov.co sin location
// bloqueadas por el patrón 'premio' en la URL_BLOCKLIST de backfill-location-inference.ts
// Son eventos reales de Bogotá, no páginas institucionales.
// =============================================================================

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n🏙️  Backfill puntual — Idartes sin location`);
  console.log(`Modo: ${isDryRun ? '🔍 DRY RUN' : '💾 GUARDAR EN BD'}\n`);

  // Buscar actividades de idartes sin location
  const activities = await prisma.activity.findMany({
    where: {
      status: 'ACTIVE',
      locationId: null,
      sourceDomain: 'idartes.gov.co',
    },
    select: { id: true, title: true, sourceUrl: true },
  });

  if (activities.length === 0) {
    console.log('✅ No hay actividades de idartes.gov.co sin location. Nada que hacer.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Encontradas: ${activities.length} actividad(es)`);
  activities.forEach(a => console.log(`  - "${a.title}"\n    ${a.sourceUrl}`));

  // Buscar ciudad Bogotá
  const bogota = await prisma.city.findFirst({
    where: { name: { contains: 'Bogot', mode: 'insensitive' } },
    select: { id: true, name: true },
  });

  if (!bogota) {
    console.error('❌ Ciudad Bogotá no encontrada en BD');
    process.exit(1);
  }
  console.log(`\nCiudad: ${bogota.name} (${bogota.id})`);

  // Buscar o crear location canónica de IDARTES
  let location = await prisma.location.findFirst({
    where: { cityId: bogota.id, name: { equals: 'IDARTES', mode: 'insensitive' } },
  });

  if (!location) {
    if (isDryRun) {
      console.log(`[DRY RUN] Crearía Location "IDARTES" en Bogotá`);
    } else {
      location = await prisma.location.create({
        data: { name: 'IDARTES', address: 'IDARTES', cityId: bogota.id, latitude: 0, longitude: 0 },
      });
      console.log(`✨ Creada Location "IDARTES" (${location.id})`);
    }
  } else {
    console.log(`Location existente: "${location.name}" (${location.id})`);
  }

  // Asignar location a las actividades
  for (const act of activities) {
    console.log(`\n${isDryRun ? '[DRY]' : '→'} "${act.title}"`);
    if (!isDryRun && location) {
      await prisma.activity.update({
        where: { id: act.id },
        data: { locationId: location.id },
      });
      console.log(`  ✅ Location asignada`);
    }
  }

  // Cobertura final
  const [withLoc, withoutLoc] = await Promise.all([
    prisma.activity.count({ where: { status: 'ACTIVE', locationId: { not: null } } }),
    prisma.activity.count({ where: { status: 'ACTIVE', locationId: null } }),
  ]);
  const total = withLoc + withoutLoc;
  console.log(`\n📈 Cobertura ${isDryRun ? '(sin cambios)' : 'post-backfill'}:`);
  console.log(`   Con location: ${withLoc} / ${total} → ${total > 0 ? ((withLoc / total) * 100).toFixed(1) : 0}%`);

  if (isDryRun) console.log('\n⚠️  DRY RUN — sin cambios en BD');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
