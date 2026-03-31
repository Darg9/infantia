/**
 * backfill-geocoding.ts
 *
 * Geocodifica retroactivamente las actividades existentes que aún no tienen
 * coordenadas válidas (0,0 o null). Usa el nuevo venue-dictionary + Nominatim.
 *
 * Uso:
 *   npx tsx scripts/backfill-geocoding.ts [--dry-run]
 *
 * Flags:
 *   --dry-run    Muestra qué haría sin guardar en BD
 */

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { geocodeAddress } from '../src/lib/geocoding';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface BackfillStats {
  total: number;
  skipped: number;
  attempted: number;
  succeeded: number;
  failed: number;
}

const stats: BackfillStats = {
  total: 0,
  skipped: 0,
  attempted: 0,
  succeeded: 0,
  failed: 0,
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log(`\n🗺️  Geocoding retroactivo — Infantia`);
  console.log(`Modo: ${dryRun ? 'DRY RUN (sin guardar)' : 'GUARDAR EN BD'}\n`);

  // Busca TODAS las locations (no solo las de actividades sin coords)
  // porque queremos actualizar todas las que tengan coords 0,0 o vacías
  const locations = await prisma.location.findMany({
    include: {
      city: { select: { name: true } },
      activities: { select: { id: true, title: true } },
    },
  });

  stats.total = locations.length;

  for (const location of locations) {
    const lat = Number(location.latitude);
    const lng = Number(location.longitude);
    const hasValidCoords = lat !== 0 && lng !== 0;

    if (hasValidCoords) {
      stats.skipped++;
      continue;
    }

    stats.attempted++;

    // Intenta geocodificar usando address + city
    const result = await geocodeAddress(location.address, location.city.name);

    if (!result) {
      console.log(
        `❌ ${location.name} (${location.address}) — no se encontró geocoding`
      );
      stats.failed++;
      continue;
    }

    const newLat = result.latitude;
    const newLng = result.longitude;

    console.log(
      `✅ ${location.name} → [${newLat.toFixed(4)}, ${newLng.toFixed(4)}]`
    );
    console.log(
      `   📌 Actividades: ${location.activities.length} (${location.activities.map((a) => `"${a.title}"`).join(', ')})`
    );

    if (!dryRun) {
      await prisma.location.update({
        where: { id: location.id },
        data: {
          latitude: newLat,
          longitude: newLng,
        },
      });
    }

    stats.succeeded++;

    // Rate limiting: Nominatim ToS requiere ~1 req/sec
    await new Promise((r) => setTimeout(r, 1100));
  }

  // Resumen
  console.log(`\n📊 Resumen:`);
  console.log(`   Total locations: ${stats.total}`);
  console.log(`   Con coords válidas (skipped): ${stats.skipped}`);
  console.log(`   Intentados: ${stats.attempted}`);
  console.log(`   ✅ Exitosos: ${stats.succeeded}`);
  console.log(`   ❌ Fallidos: ${stats.failed}`);
  console.log(
    `   Tasa éxito: ${stats.attempted > 0 ? ((stats.succeeded / stats.attempted) * 100).toFixed(1) : 0}%\n`
  );

  if (dryRun) {
    console.log('⚠️  Modo DRY RUN — no se guardó nada en BD\n');
  } else if (stats.succeeded > 0) {
    console.log(`✨ ${stats.succeeded} locations geocodificadas y guardadas\n`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
