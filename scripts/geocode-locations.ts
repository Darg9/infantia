// =============================================================================
// geocode-locations.ts — Backfill de coordenadas reales via Nominatim
//
// Uso:
//   npx tsx scripts/geocode-locations.ts          # geocodifica todas sin coords
//   npx tsx scripts/geocode-locations.ts --all    # re-geocodifica todas
//   npx tsx scripts/geocode-locations.ts --dry-run
// =============================================================================

import { prisma } from '../src/lib/db';
import { geocodeAddress } from '../src/lib/geocoding';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE_ALL = process.argv.includes('--all');

async function main() {
  console.log('🌍 Geocodificación de locations — Nominatim (OpenStreetMap)');
  console.log(`   Modo: ${DRY_RUN ? 'DRY RUN' : 'REAL'} | Forzar todas: ${FORCE_ALL}`);
  console.log('');

  // Obtener locations a geocodificar
  const locations = await prisma.location.findMany({
    where: FORCE_ALL
      ? {}
      : {
          OR: [
            { latitude: 0 },
            { longitude: 0 },
          ],
        },
    include: {
      city: { select: { name: true } },
    },
    orderBy: { id: 'asc' },
  });

  console.log(`📍 Locations a procesar: ${locations.length}`);
  if (locations.length === 0) {
    console.log('✅ Todas las locations ya tienen coordenadas reales.');
    return;
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    const cityName = loc.city?.name ?? 'Bogotá';

    // Construir dirección de búsqueda
    // Prioridad: address completa → si es genérica, usar solo neighborhood/name
    const addressQuery = buildAddressQuery(loc.address, loc.neighborhood, loc.name, cityName);

    console.log(`[${i + 1}/${locations.length}] "${addressQuery.slice(0, 70)}"`);

    if (DRY_RUN) {
      console.log(`   → DRY RUN — omitiría geocodificar`);
      skipped++;
      continue;
    }

    const result = await geocodeAddress(addressQuery, cityName);

    if (!result) {
      console.log(`   ✗ Sin resultado — coordenadas no actualizadas`);
      failed++;
      continue;
    }

    // Verificar que las coordenadas son plausibles para Colombia
    if (!isInColombia(result.latitude, result.longitude)) {
      console.log(`   ✗ Coordenadas fuera de Colombia: [${result.latitude}, ${result.longitude}]`);
      failed++;
      continue;
    }

    await prisma.location.update({
      where: { id: loc.id },
      data: {
        latitude: result.latitude,
        longitude: result.longitude,
      },
    });

    console.log(`   ✓ [${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}] — ${result.displayName.slice(0, 60)}`);
    success++;
  }

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`✅ Geocodificadas: ${success}`);
  console.log(`✗  Fallidas:      ${failed}`);
  console.log(`⏭  Omitidas:      ${skipped}`);
  console.log('═══════════════════════════════════════');
}

function buildAddressQuery(
  address: string,
  neighborhood: string | null,
  name: string,
  city: string,
): string {
  // Si address es genérica (ej: "Bogotá" o igual al nombre de la ciudad), usar el nombre del lugar
  const genericPatterns = [city.toLowerCase(), 'colombia', 'bogota', 'virtual', 'online', 'en línea'];
  const isGeneric = genericPatterns.some((p) => address.toLowerCase().trim() === p);

  if (isGeneric && name && name !== address) {
    // Usar el nombre del venue
    return [name, neighborhood, city].filter(Boolean).join(', ');
  }

  // Usar dirección completa
  return [address, neighborhood].filter(Boolean).join(', ');
}

function isInColombia(lat: number, lng: number): boolean {
  // Bounding box aproximado de Colombia
  return lat >= -4.5 && lat <= 13.5 && lng >= -82 && lng <= -66;
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
