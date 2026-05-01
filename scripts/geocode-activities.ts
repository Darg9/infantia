import { getErrorMessage } from '../src/lib/error';
// =============================================================================
// geocode-activities.ts — Backfill de locations para actividades existentes
//
// Para cada actividad sin location, busca el nombre/lugar en el título y
// crea un registro Location geocodificado via Nominatim.
//
// Uso:
//   npx tsx scripts/geocode-activities.ts           # procesa actividades sin location
//   npx tsx scripts/geocode-activities.ts --dry-run
//   npx tsx scripts/geocode-activities.ts --limit 20
// =============================================================================

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { geocodeAddress } from '../src/lib/geocoding';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '0');

// Venues conocidos de instituciones culturales en Bogotá
// Cuando el título menciona un venue, usamos su dirección real
const KNOWN_VENUES: { keywords: string[]; address: string; neighborhood: string }[] = [
  { keywords: ['virgilio barco', 'parque simón bolívar'], address: 'Calle 63 # 59A-06', neighborhood: 'Teusaquillo' },
  { keywords: ['el tintal'], address: 'Carrera 86B # 6C-17', neighborhood: 'Kennedy' },
  { keywords: ['julio mario santo domingo', 'santo domingo'], address: 'Calle 170 # 67-51', neighborhood: 'Suba' },
  { keywords: ['el tunal'], address: 'Carrera 20 # 56B-09 Sur', neighborhood: 'Tunjuelito' },
  { keywords: ['rafael uribe uribe', 'uribe uribe'], address: 'Carrera 14 # 34-10 Sur', neighborhood: 'Antonio Nariño' },
  { keywords: ['carlos e. restrepo', 'carlos restrepo'], address: 'Carrera 45 # 22-02', neighborhood: 'Teusaquillo' },
  { keywords: ['bosa'], address: 'Carrera 86B # 73-74 Sur', neighborhood: 'Bosa' },
  { keywords: ['usaquén'], address: 'Calle 114 # 9-01', neighborhood: 'Usaquén' },
  { keywords: ['chapinero'], address: 'Carrera 7 # 62-90', neighborhood: 'Chapinero' },
  { keywords: ['candelaria', 'la candelaria'], address: 'Carrera 3 # 12-14', neighborhood: 'La Candelaria' },
  { keywords: ['teatro mayor', 'julio mario'], address: 'Calle 170 # 67-51', neighborhood: 'Suba' },
  { keywords: ['teatro nacional'], address: 'Calle 71 # 10-25', neighborhood: 'Chapinero' },
  { keywords: ['parque de los novios', 'parque novios'], address: 'Carrera 29 # 25-19', neighborhood: 'Teusaquillo' },
  { keywords: ['plaza de bolívar', 'plaza bolívar'], address: 'Carrera 8 # 10-65', neighborhood: 'La Candelaria' },
  { keywords: ['jardín botánico', 'jardin botanico'], address: 'Calle 63 # 68-95', neighborhood: 'Fontibón' },
  { keywords: ['maloka'], address: 'Carrera 68D # 40A-51', neighborhood: 'Fontibón' },
  { keywords: ['planetario'], address: 'Carrera 6 # 26-92', neighborhood: 'La Candelaria' },
  { keywords: ['festival iberoamericano', 'teatro iberoamericano'], address: 'Carrera 6 # 26-92', neighborhood: 'La Candelaria' },
];

function detectVenue(title: string, description: string): { address: string; neighborhood: string } | null {
  const text = `${title} ${description}`.toLowerCase();
  for (const venue of KNOWN_VENUES) {
    if (venue.keywords.some((k) => text.includes(k.toLowerCase()))) {
      return { address: venue.address, neighborhood: venue.neighborhood };
    }
  }
  return null;
}

// Coordenadas base por proveedor (fallback cuando no hay venue detectado)
const PROVIDER_FALLBACK: Record<string, { address: string; neighborhood: string }> = {
  'biblored.gov.co':                  { address: 'Calle 63 # 59A-06', neighborhood: 'Teusaquillo' }, // Virgilio Barco
  'idartes.gov.co':                   { address: 'Carrera 6 # 26-92', neighborhood: 'La Candelaria' }, // Sede IDARTES
  'bogota.gov.co':                    { address: 'Carrera 8 # 10-65', neighborhood: 'La Candelaria' }, // Plaza Bolívar
  'culturarecreacionydeporte.gov.co': { address: 'Carrera 8 # 9-83', neighborhood: 'La Candelaria' },
};

async function main() {
  console.log('🗺️  Backfill de geocoding para actividades existentes');
  console.log(`   Modo: ${DRY_RUN ? 'DRY RUN' : 'REAL'} | Límite: ${LIMIT || 'sin límite'}`);
  console.log('');

  // Obtener ciudad de Bogotá
  const bogota = await prisma.city.findFirst({
    where: { name: { contains: 'Bogotá', mode: 'insensitive' } },
  });
  if (!bogota) {
    console.error('❌ Ciudad Bogotá no encontrada en BD. Ejecuta el seed primero.');
    return;
  }

  // Actividades sin locationId
  const activities = await prisma.activity.findMany({
    where: { locationId: null },
    select: {
      id: true,
      title: true,
      description: true,
      provider: { select: { name: true, website: true } },
    },
    take: LIMIT || undefined,
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📍 Actividades sin location: ${activities.length}`);
  if (activities.length === 0) {
    console.log('✅ Todas las actividades ya tienen location.');
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    console.log(`\n[${i + 1}/${activities.length}] "${act.title.substring(0, 60)}"`);

    // 1. Detectar venue en título/descripción
    let addressInfo = detectVenue(act.title, act.description || '');

    // 2. Fallback por proveedor
    if (!addressInfo && act.provider?.website) {
      try {
        const hostname = new URL(act.provider.website).hostname.replace('www.', '');
        const key = Object.keys(PROVIDER_FALLBACK).find((k) => hostname.includes(k));
        if (key) addressInfo = PROVIDER_FALLBACK[key];
      } catch { /* ignore */ }
    }

    // 3. Fallback absoluto: centro de Bogotá
    if (!addressInfo) {
      addressInfo = { address: 'Bogotá, Colombia', neighborhood: '' };
    }

    console.log(`   📌 ${addressInfo.address}${addressInfo.neighborhood ? `, ${addressInfo.neighborhood}` : ''}`);

    if (DRY_RUN) {
      console.log(`   → DRY RUN`);
      success++;
      continue;
    }

    try {
      // Buscar location existente con misma dirección
      const existingLoc = await prisma.location.findFirst({
        where: { address: addressInfo.address, cityId: bogota.id },
      });

      let locationId: string;

      if (existingLoc) {
        locationId = existingLoc.id;
        console.log(`   ♻️  Reutilizando location existente`);
      } else {
        // Geocodificar
        const geoResult = await geocodeAddress(addressInfo.address, 'Bogotá');

        const newLoc = await prisma.location.create({
          data: {
            name: addressInfo.neighborhood || addressInfo.address.substring(0, 255),
            address: addressInfo.address,
            neighborhood: addressInfo.neighborhood || null,
            cityId: bogota.id,
            latitude: geoResult?.latitude ?? 0,
            longitude: geoResult?.longitude ?? 0,
          },
        });
        locationId = newLoc.id;

        if (geoResult) {
          console.log(`   ✓ [${geoResult.latitude.toFixed(4)}, ${geoResult.longitude.toFixed(4)}]`);
        } else {
          console.log(`   ⚠️ Sin coords — guardado con lat=0 lng=0`);
        }
      }

      // Vincular actividad con location
      await prisma.activity.update({
        where: { id: act.id },
        data: { locationId },
      });

      success++;
    } catch (err: unknown) {
      console.error(`   ✗ Error: ${getErrorMessage(err)}`);
      failed++;
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`✅ Geocodificadas: ${success}`);
  console.log(`✗  Fallidas:      ${failed}`);
  console.log('═══════════════════════════════════════');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
