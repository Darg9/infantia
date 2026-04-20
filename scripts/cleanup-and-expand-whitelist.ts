import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n🧹 Cleanup + Whitelist Expansion — Paso 2`);
  console.log(`Modo: ${isDryRun ? '🔍 DRY RUN' : '💾 GUARDAR EN BD'}\n`);

  // Verificar status válidos
  const statuses = await prisma.activity.groupBy({ by: ['status'], _count: { _all: true } });
  console.log('Status válidos en BD:', statuses.map(s => `${s.status}(${s._count._all})`).join(', '));

  // ─── PASO 1: Desactivar bogota.gov.co — ruido institucional ─────────────────
  const BOGOTA_NOISE_KEYWORDS = [
    'noticia', 'noticias', 'gestión', 'gestion', 'hábitat', 'habitat',
    'premio', 'comunicado', 'balance', 'informe', 'movilidad', 'educación',
    'educacion', 'mujer en', 'medio ambiente', 'salud en', 'integración',
    'integracion', 'gobierno abierto', 'plan de ordenamiento', 'mantenimiento',
    'internacional', 'jurídica', 'juridica', 'desarrollo económico',
    'monserrate', 'caminatas', 'bogota.gov.co logra'
  ];

  // Primero contar cuántos serán afectados
  const bogotaNoiseCandidates = await prisma.activity.findMany({
    where: {
      status: 'ACTIVE',
      sourceUrl: { contains: 'bogota.gov.co', mode: 'insensitive' },
      NOT: { sourceUrl: { contains: 'bogota.gov.co/que-hacer/agenda-cultural', mode: 'insensitive' } },
      title: { in: [], mode: 'insensitive' }, // placeholder - overrdie below
    },
    select: { id: true, title: true, sourceUrl: true }
  });

  // Re-query without the bad filter
  const allBogotaActives = await prisma.activity.findMany({
    where: {
      status: 'ACTIVE',
      sourceUrl: { contains: 'bogota.gov.co', mode: 'insensitive' },
      NOT: { sourceUrl: { contains: 'bogota.gov.co/que-hacer/agenda-cultural', mode: 'insensitive' } },
    },
    select: { id: true, title: true, sourceUrl: true }
  });

  const bogotaToDeactivate = allBogotaActives.filter(a =>
    BOGOTA_NOISE_KEYWORDS.some(kw => a.title.toLowerCase().includes(kw.toLowerCase()))
  );

  console.log(`\n[1/3] 🗑️  bogota.gov.co — Ruido a desactivar: ${bogotaToDeactivate.length}`);
  bogotaToDeactivate.forEach(a => console.log(`  • "${a.title}"`));

  // ─── PASO 2: Desactivar api.whatsapp.com ────────────────────────────────────
  const whatsappActivities = await prisma.activity.findMany({
    where: {
      status: 'ACTIVE',
      sourceUrl: { contains: 'api.whatsapp.com', mode: 'insensitive' },
    },
    select: { id: true, title: true }
  });

  console.log(`\n[2/3] 📱 whatsapp.com — A desactivar: ${whatsappActivities.length}`);
  whatsappActivities.forEach(a => console.log(`  • "${a.title}"`));

  if (!isDryRun) {
    const allToDeactivate = [
      ...bogotaToDeactivate.map(a => a.id),
      ...whatsappActivities.map(a => a.id),
    ];

    if (allToDeactivate.length > 0) {
      const result = await prisma.activity.updateMany({
        where: { id: { in: allToDeactivate } },
        data: { status: 'EXPIRED' } // EXPIRED = fuera del portal, sin borrar
      });
      console.log(`\n  ✅ ${result.count} actividades marcadas como EXPIRED`);
    }
  }

  // ─── PASO 3: Añadir fce.com.co + banrepcultural.org a whitelist y re-run ───
  const NEW_WHITELIST: Record<string, { cityName: string; locationName: string }> = {
    'fce.com.co':          { cityName: 'Bogotá', locationName: 'Feria de Cultura Económica' },
    'banrepcultural.org':  { cityName: 'Bogotá', locationName: 'Banco de la República'      },
  };

  const cities = await prisma.city.findMany({ select: { id: true, name: true } });
  const cityByName = new Map(cities.map(c => [c.name.toLowerCase(), c]));
  const locationCache = new Map<string, string>();

  async function getOrCreateLocation(cityId: string, locationName: string): Promise<string | null> {
    const key = `${cityId}:${locationName}`;
    if (locationCache.has(key)) return locationCache.get(key)!;
    let loc = await prisma.location.findFirst({
      where: { cityId, name: { equals: locationName, mode: 'insensitive' } }
    });
    if (!loc) {
      if (isDryRun) { locationCache.set(key, `dry-${key}`); return `dry-${key}`; }
      loc = await prisma.location.create({
        data: { name: locationName, address: locationName, cityId, latitude: 0, longitude: 0 }
      });
      console.log(`  ✨ Creada Location: "${locationName}"`);
    }
    locationCache.set(key, loc.id);
    return loc.id;
  }

  let newlyInferred = 0;
  console.log('\n[3/3] 📍 Añadiendo nuevos dominios a whitelist...');

  for (const [pattern, meta] of Object.entries(NEW_WHITELIST)) {
    const city = cityByName.get(meta.cityName.toLowerCase());
    if (!city) { console.warn(`  ⚠️  Ciudad "${meta.cityName}" no encontrada`); continue; }

    const activities = await prisma.activity.findMany({
      where: {
        locationId: null,
        status: 'ACTIVE',
        OR: [
          { sourceDomain: { contains: pattern, mode: 'insensitive' } },
          { sourceUrl: { contains: pattern, mode: 'insensitive' } },
        ]
      },
      select: { id: true, title: true }
    });

    console.log(`  [${pattern}] → ${activities.length} actividades`);
    activities.forEach(a => console.log(`    ${isDryRun ? '[DRY]' : '→'} "${a.title}"`));

    if (!isDryRun && activities.length > 0) {
      const locationId = await getOrCreateLocation(city.id, meta.locationName);
      if (!locationId) continue;
      await prisma.activity.updateMany({
        where: { id: { in: activities.map(a => a.id) } },
        data: { locationId }
      });
      newlyInferred += activities.length;
    } else {
      newlyInferred += activities.length;
    }
  }

  // ─── Resumen de cobertura ───────────────────────────────────────────────────
  const [withLoc, withoutLoc] = await Promise.all([
    prisma.activity.count({ where: { status: 'ACTIVE', locationId: { not: null } } }),
    prisma.activity.count({ where: { status: 'ACTIVE', locationId: null } }),
  ]);
  const total = withLoc + withoutLoc;
  const pct = total > 0 ? ((withLoc / total) * 100).toFixed(1) : '0';

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Resumen`);
  console.log(`   Desactivadas (basura):     ${bogotaToDeactivate.length + whatsappActivities.length}`);
  console.log(`   Nuevos dominios inferidos: ${newlyInferred}`);
  console.log(`   coverage_pct = ${pct}% (${withLoc}/${total} activas con location)`);
  console.log(isDryRun ? '\n⚠️  DRY RUN — sin cambios en BD' : '\n✅ BD actualizada');

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
