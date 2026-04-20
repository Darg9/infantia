import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

// =============================================================================
// Backfill: Location Inference from Source Domain (Ruta C)
//
// Estrategia: Fuentes con dominio inequívocamente asociado a una ciudad reciben
//   locationId automáticamente. Solo confidence=1.0. Sin geocoding. Trazable
//   via sourceDomain. Reversible (ver ROLLBACK al final).
//
// Uso:
//   npx tsx scripts/backfill-location-inference.ts [--dry-run]
// =============================================================================

// ---------------------------------------------------------------------------
// DOMAIN_CITY_MAP — Whitelist curada con confianza = 1.0
//
// REGLA ESPECIAL: Si el pattern contiene '/', se hace match por ruta
//   exacta del sourceUrl (path-level). Si no, match por dominio/subdominio.
// Solo se incluyen fuentes 100% deterministas geográficamente.
// ---------------------------------------------------------------------------
const DOMAIN_CITY_MAP: Record<string, { cityName: string; locationName: string }> = {
  // Bogotá — Instituciones oficiales del Distrito
  'planetariodebogota.gov.co':          { cityName: 'Bogotá', locationName: 'Planetario de Bogotá'     },
  'idartes.gov.co':                     { cityName: 'Bogotá', locationName: 'IDARTES'                   },
  'biblored.gov.co':                    { cityName: 'Bogotá', locationName: 'BibloRed'                  },
  'cinematecadebogota.gov.co':          { cityName: 'Bogotá', locationName: 'Cinemateca de Bogotá'      },
  'idrd.gov.co':                        { cityName: 'Bogotá', locationName: 'IDRD'                      },
  'jbb.gov.co':                         { cityName: 'Bogotá', locationName: 'Jardín Botánico de Bogotá' },
  'museodelbogotazo.gov.co':            { cityName: 'Bogotá', locationName: 'Museo del Bogotazo'        },
  'maloka.org':                         { cityName: 'Bogotá', locationName: 'Maloka'                    },
  'fuga.gov.co':                        { cityName: 'Bogotá', locationName: 'FUGA Bogotá'               },

  // bogota.gov.co — SOLO ruta de agenda cultural (guardrail contra páginas institucionales)
  'bogota.gov.co/que-hacer/agenda-cultural': { cityName: 'Bogotá', locationName: 'Secretaría de Cultura Bogotá' },
  'bogota.gov.co/programate':                { cityName: 'Bogotá', locationName: 'Secretaría de Cultura Bogotá' },

  // Medellín — Instituciones oficiales
  'parqueexplora.org':          { cityName: 'Medellín', locationName: 'Parque Explora'    },
  'culturaantioquena.co':       { cityName: 'Medellín', locationName: 'Cultura Antioqueña' },
  'eafit.edu.co':               { cityName: 'Medellín', locationName: 'Universidad EAFIT'  },
  'teatropablo.com.co':         { cityName: 'Medellín', locationName: 'Teatro Pablo Tobón' },

  // Redes Sociales — Solo handles oficiales verificados
  'instagram.com/planetariobogota': { cityName: 'Bogotá',   locationName: 'Planetario de Bogotá' },
  'instagram.com/bibloredbogota':   { cityName: 'Bogotá',   locationName: 'BibloRed'              },
  'instagram.com/idartes':          { cityName: 'Bogotá',   locationName: 'IDARTES'               },
  'instagram.com/parqueexplora':    { cityName: 'Medellín', locationName: 'Parque Explora'        },
};

// Patrones de sourceUrl que nunca deben recibir cityId aunque coincidan dominio.
// Son páginas institucionales/genéricas capturadas por el scraper por error.
const URL_BLOCKLIST = [
  '/archivo',
  '/busqueda',
  'premio',
  'gobierno-digital',
  'web-awards',
  'gana-premio',
  'noticias',
  'directorio-institucional',
  'relacionamiento-con-la-ciudadanía',
  'certificado-de-cumplimiento',
  'tratamiento-de-datos',
  'terminos-y-condiciones',
  'pqrs',
  '/bienvenido',
  'sostenibilidad-del-ecosistema',
  'culturas-en-comun',
  'programa-distrital-de-estimulos',
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const isDryRun = process.argv.includes('--dry-run');

interface Stats {
  total: number; inferred: number; skipped: number; alreadyHas: number; failed: string[];
}

async function main() {
  console.log(`\n📍 Backfill Location Inference — Ruta C`);
  console.log(`Modo: ${isDryRun ? '🔍 DRY RUN (sin guardar)' : '💾 GUARDAR EN BD'}\n`);
  console.log(`Dominios en whitelist: ${Object.keys(DOMAIN_CITY_MAP).length}\n`);

  const stats: Stats = { total: 0, inferred: 0, skipped: 0, alreadyHas: 0, failed: [] };

  // Cargar ciudades disponibles en BD
  const cities = await prisma.city.findMany({ select: { id: true, name: true } });
  const cityByName = new Map(cities.map(c => [c.name.toLowerCase(), c]));

  // Cache de locations canónicas por ciudad (una por proveedor)
  const locationCache = new Map<string, string>(); // `cityId:locationName` → locationId

  async function getOrCreateLocation(cityId: string, locationName: string): Promise<string | null> {
    const cacheKey = `${cityId}:${locationName}`;
    if (locationCache.has(cacheKey)) return locationCache.get(cacheKey)!;

    // Buscar location existente para este proveedor+ciudad
    let location = await prisma.location.findFirst({
      where: { cityId, name: { equals: locationName, mode: 'insensitive' } }
    });

    if (!location) {
      if (isDryRun) {
        console.log(`  [DRY RUN] Crearía Location: "${locationName}" en cityId=${cityId}`);
        return `dry-run-${cityId}-${locationName}`;
      }
      // Crear location canónica para este proveedor
      location = await prisma.location.create({
        data: {
          name: locationName,
          address: locationName, // Dirección genérica = nombre del proveedor
          cityId,
          latitude: 0,
          longitude: 0,
        }
      });
      console.log(`  ✨ Creada Location: "${locationName}" (${location.id})`);
    }

    locationCache.set(cacheKey, location.id);
    return location.id;
  }

  // Procesar cada entrada del mapa
  for (const [pattern, meta] of Object.entries(DOMAIN_CITY_MAP)) {
    const city = cityByName.get(meta.cityName.toLowerCase());
    if (!city) {
      console.warn(`⚠️  Ciudad "${meta.cityName}" no encontrada en BD — saltando ${pattern}`);
      continue;
    }

    // Buscar actividades sin location cuyo sourceUrl o sourceDomain coincide con el patrón
    // y no están en la lista negra de URLs institucionales
    const candidateActivities = await prisma.activity.findMany({
      where: {
        locationId: null,
        OR: [
          { sourceDomain: { contains: pattern, mode: 'insensitive' } },
          { sourceUrl:    { contains: pattern, mode: 'insensitive' } },
        ]
      },
      select: { id: true, title: true, sourceUrl: true, sourceDomain: true }
    });

    // Aplicar blocklist en memory (más flexible que SQL ILIKE múltiple)
    const activities = candidateActivities.filter(act => {
      const url = (act.sourceUrl ?? '').toLowerCase();
      return !URL_BLOCKLIST.some(blocked => url.includes(blocked.toLowerCase()));
    });

    stats.total += activities.length;
    const blockedCount = candidateActivities.length - activities.length;

    if (activities.length === 0) {
      if (blockedCount > 0) {
        console.log(`[${pattern}] → ${blockedCount} bloqueadas por blocklist, 0 válidas.`);
      } else {
        console.log(`[${pattern}] → 0 actividades sin location.`);
      }
      continue;
    }

    console.log(`\n[${pattern}] → Ciudad: ${meta.cityName} | Válidas: ${activities.length}${blockedCount > 0 ? ` (${blockedCount} bloqueadas)` : ''}`);

    const locationId = await getOrCreateLocation(city.id, meta.locationName);
    if (!locationId) { stats.failed.push(pattern); continue; }

    for (const act of activities) {
      console.log(`  ${isDryRun ? '[DRY]' : '→'} "${act.title}"`);
      if (!isDryRun) {
        await prisma.activity.update({
          where: { id: act.id },
          data: { locationId }
        });
      }
      stats.inferred++;
    }
  }

  // Resumen
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Resumen Backfill Ruta C`);
  console.log(`   Actividades analizadas: ${stats.total}`);
  console.log(`   ✅ Con location inferida: ${stats.inferred}`);
  console.log(`   ⏭️  Ya tenían location:   ${stats.alreadyHas}`);
  console.log(`   ❌ Fallidos (ciudad n/a): ${stats.failed.length}`);
  if (stats.failed.length) console.log(`   Fallos: ${stats.failed.join(', ')}`);
  console.log(isDryRun ? '\n⚠️  DRY RUN — sin cambios en BD' : '\n✨ BD actualizada');

  // Chequeo de cobertura final
  const [withLoc, withoutLoc] = await Promise.all([
    prisma.activity.count({ where: { status: 'ACTIVE', locationId: { not: null } } }),
    prisma.activity.count({ where: { status: 'ACTIVE', locationId: null } }),
  ]);
  const total = withLoc + withoutLoc;
  const pct = total > 0 ? ((withLoc / total) * 100).toFixed(1) : '0';
  console.log(`\n📈 Cobertura ${isDryRun ? '(sin cambios)' : '(post-backfill)'}:`);
  console.log(`   Con location: ${withLoc} / ${total} → ${pct}% cobertura`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

// =============================================================================
// ROLLBACK (ejecutar manualmente si es necesario)
// =============================================================================
// El rollback es simple: las actividades actualizadas pueden identificarse por
// su sourceDomain. Ejecutar este SQL en Supabase:
//
// UPDATE activities
// SET "locationId" = NULL
// WHERE "locationId" IN (
//   SELECT l.id FROM locations l
//   WHERE l.latitude = 0 AND l.longitude = 0 -- son las ubicaciones canónicas inferidas
// )
// AND source_domain IN (
//   'planetariodebogota.gov.co','idartes.gov.co','biblored.gov.co',
//   'cinematecadebogota.gov.co','bogota.gov.co','parqueexplora.org'
//   -- ... añadir todos los dominios del DOMAIN_CITY_MAP
// );
// =============================================================================
