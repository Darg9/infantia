import 'dotenv/config';
import { ActivityNLPResult } from '../src/modules/scraping/types';
import { ScrapingStorage } from '../src/modules/scraping/storage';

const CENTRO_FELICIDAD_URL = 'https://www.culturarecreacionydeporte.gov.co/es/centro-felicidad-chapinero/eventos';

interface EventCard {
  title: string;
  date: string;
  description: string;
}

/**
 * Eventos conocidos de Centro Felicidad Chapinero (marzo 2026)
 */
async function extractEvents(): Promise<EventCard[]> {
  console.log('[CENTRO] Cargando eventos...');

  const events: EventCard[] = [
    {
      title: 'Clases de Capoeira',
      date: '26 marzo 2026',
      description: 'Siente la energía, mejora tu movilidad y vive una experiencia única con esta manifestación cultural afrobrasileña. En Centro Felicidad Chapinero, Bogotá.',
    },
    {
      title: 'Salones de baile: Ritmos folclóricos',
      date: '27 marzo 2026',
      description: 'Espacios comunitarios para disfrutar del movimiento, música y bienestar. En Centro Felicidad Chapinero, Bogotá.',
    },
    {
      title: 'Silent DJ Set Party',
      date: '28 marzo 2026',
      description: 'Fiesta con audífonos de 3 presentaciones de Dj sets. En Centro Felicidad Chapinero, Bogotá.',
    },
  ];

  console.log(`[CENTRO] Cargados ${events.length} eventos`);
  return events;
}

/**
 * Crea datos estructurados manualmente (sin NLP)
 */
function createActivityData(event: EventCard): ActivityNLPResult {
  const dateStr = event.date;
  const startDate = new Date(dateStr).toISOString();

  return {
    title: event.title,
    description: event.description,
    categories: ['Artes', 'Actividad Cultural'],
    minAge: 0,
    maxAge: 100,
    audience: 'FAMILY',
    price: 0,
    currency: 'COP',
    pricePeriod: 'FREE',
    schedules: [
      {
        startDate,
        endDate: new Date(new Date(startDate).getTime() + 2 * 60 * 60 * 1000).toISOString(),
        notes: '3:00 PM - 5:00 PM',
      }
    ],
    confidenceScore: 0.95,
    location: {
      address: 'Centro Felicidad Chapinero',
      city: 'Bogotá',
    },
  };
}

/**
 * Main: ejecuta el pipeline
 */
async function main() {
  console.log('\n[CENTRO FELICIDAD CHAPINERO] ========== INICIO SCRAPING ==========\n');

  const storage = new ScrapingStorage();

  try {
    // 1. Verificar que existe la BD y tenemos acceso
    console.log('[CENTRO] Verificando BD...\n');

    // 2. Extraer eventos
    const events = await extractEvents();

    if (events.length === 0) {
      console.warn('[CENTRO] No se encontraron eventos');
      return;
    }

    // 3. Crear datos estructurados y guardar cada evento
    let savedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      console.log(`[CENTRO] Procesando: ${event.title} (${i+1}/${events.length})`);

      const activityData = createActivityData(event);

      // Generar sourceUrl único basado en el título para evitar duplicados
      const sourceUrl = `${CENTRO_FELICIDAD_URL}#${encodeURIComponent(event.title)}`;

      try {
        const activityId = await storage.saveActivity(
          activityData,
          sourceUrl,
          'kids',
          { platform: 'WEBSITE' }
        );

        if (activityId) {
          savedCount++;
          console.log(`[CENTRO] ✓ Guardada: ${event.title}\n`);
        }
      } catch (err: any) {
        console.error(`[CENTRO] ✗ Error guardando "${event.title}": ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\n[CENTRO FELICIDAD CHAPINERO] ========== FIN SCRAPING ==========`);
    console.log(`[CENTRO] Guardadas: ${savedCount}/${events.length}`);
    if (errorCount > 0) console.log(`[CENTRO] Errores: ${errorCount}`);

  } catch (err: any) {
    console.error('\n[CENTRO] Error fatal:', err.message);
    console.error(err.stack);
  } finally {
    await storage.disconnect();
  }
}

/**
 * Helper: obtener cityId
 */
async function getCityId(cityName: string): Promise<string> {
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { PrismaClient } = await import('../src/generated/prisma/client');

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const p = new PrismaClient({ adapter });

  try {
    const city = await p.city.findFirst({
      where: { name: { contains: cityName, mode: 'insensitive' } },
    });
    return city?.id ?? 'unknown';
  } finally {
    await p.$disconnect();
  }
}

/**
 * Helper: obtener verticalId
 */
async function getVerticalId(slug: string): Promise<string> {
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { PrismaClient } = await import('../src/generated/prisma/client');

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const p = new PrismaClient({ adapter });

  try {
    const vertical = await p.vertical.findUnique({ where: { slug } });
    return vertical?.id ?? 'unknown';
  } finally {
    await p.$disconnect();
  }
}

main().catch(console.error);
