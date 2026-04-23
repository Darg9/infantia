import { prisma } from '../src/lib/db';

async function main() {
  console.log('=== Validación de integridad de coordenadas ===\n');

  // 1. Coordenadas = 0 exacto
  const exactZero = await prisma.location.findMany({
    where: { OR: [{ latitude: 0 }, { longitude: 0 }] },
    select: { id: true, name: true, latitude: true, longitude: true, cityId: true },
  });

  // 2. Coordenadas fuera de rango geográfico válido
  const outOfRange = await prisma.location.findMany({
    where: {
      OR: [
        { latitude: { gt: 90 } },
        { latitude: { lt: -90 } },
        { longitude: { gt: 180 } },
        { longitude: { lt: -180 } },
      ],
    },
    select: { id: true, name: true, latitude: true, longitude: true },
  });

  // 3. Coordenadas invertidas (lat/lng swapped) — lat de Colombia ~1-12, lng ~-66 a -79
  const swapped = await prisma.location.findMany({
    where: {
      latitude: { gt: 50 },  // latitudes colombianas nunca superan 13
    },
    select: { id: true, name: true, latitude: true, longitude: true },
  });

  // 4. Valores basura muy cercanos a cero (pero no exactamente 0)
  const nearZero = await prisma.location.findMany({
    where: {
      AND: [
        { latitude: { gt: -0.001 } },
        { latitude: { lt: 0.001 } },
        { latitude: { not: 0 } },
      ],
    },
    select: { id: true, name: true, latitude: true, longitude: true },
  });

  // 5. Validar ciudades tienen defaultLat/Lng
  const cities = await prisma.city.findMany({
    select: { name: true, defaultLat: true, defaultLng: true, defaultZoom: true },
  });

  console.log('1. Coordenadas en cero (exacto):', exactZero.length);
  if (exactZero.length > 0) console.log('   Muestra:', exactZero.slice(0, 3));

  console.log('2. Coordenadas fuera de rango [-90/90, -180/180]:', outOfRange.length);
  if (outOfRange.length > 0) console.log('   Detalle:', outOfRange.slice(0, 3));

  console.log('3. Posibles lat/lng invertidos (lat > 50):', swapped.length);
  if (swapped.length > 0) console.log('   Detalle:', swapped.slice(0, 3));

  console.log('4. Coordenadas "basura" ~0 (no cero exacto):', nearZero.length);
  if (nearZero.length > 0) console.log('   Detalle:', nearZero.slice(0, 3));

  console.log('\n5. Ciudades con coordenadas por defecto:');
  cities.forEach(c => {
    const ok = c.defaultLat && c.defaultLng ? '✅' : '❌';
    console.log(`   ${ok} ${c.name}: lat=${c.defaultLat}, lng=${c.defaultLng}, zoom=${c.defaultZoom}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
