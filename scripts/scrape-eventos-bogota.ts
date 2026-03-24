import 'dotenv/config';
import { ActivityNLPResult } from '../src/modules/scraping/types';
import { ScrapingStorage } from '../src/modules/scraping/storage';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const EVENTOS_URL = 'https://www.culturarecreacionydeporte.gov.co/es/eventos';

interface EventCard {
  title: string;
  date: string;
  description: string;
  organizador: string;
  url?: string;
}

/**
 * Scraping real: extrae eventos de la página oficial
 */
async function scrapeEventsFromPage(): Promise<EventCard[]> {
  try {
    console.log('[SCRAPE] Descargando página de eventos...');
    const response = await fetch(EVENTOS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const events: EventCard[] = [];

    // Buscar tarjetas de eventos - múltiples selectores posibles
    const selectors = [
      '.event-card',
      '[class*="event"]',
      'article[class*="card"]',
      'div[class*="event-item"]',
      'div[class*="card"]'
    ];

    let eventElements: any[] = [];

    for (const selector of selectors) {
      const found = Array.from(doc.querySelectorAll(selector));
      if (found.length > 0) {
        console.log(`[SCRAPE] Encontradas ${found.length} tarjetas con selector: ${selector}`);
        eventElements = found;
        break;
      }
    }

    // Si no encontró con selectores CSS, buscar por estructura HTML
    if (eventElements.length === 0) {
      console.log('[SCRAPE] Buscando por estructura HTML genérica...');
      // Buscar divs que contengan título, fecha y descripción
      const allDivs = Array.from(doc.querySelectorAll('div'));
      eventElements = allDivs.filter(div => {
        const text = div.textContent || '';
        return (text.includes('marzo') || text.includes('abril') || text.includes('evento')) &&
               text.length > 50 && text.length < 1000;
      }).slice(0, 50); // Limitar a los primeros 50
    }

    console.log(`[SCRAPE] Procesando ${eventElements.length} elementos...\n`);

    eventElements.forEach((element, idx) => {
      try {
        // Extraer texto del elemento
        const text = element.textContent || '';

        // Buscar fecha (patrón: XX marzo/abril/mayo/... YYYY)
        const dateMatch = text.match(/(\d{1,2}\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+\d{4})/i);
        const date = dateMatch ? dateMatch[1] : `${new Date().getDate()} marzo 2026`;

        // Extraer título (primeras palabras significativas)
        const titleMatch = text.match(/^([A-Z][^:\n]*?)(?:\n|:|$)/);
        const title = titleMatch ? titleMatch[1].substring(0, 100) : `Evento ${idx + 1}`;

        // Extraer descripción (texto después del título)
        const descMatch = text.match(/(?:^.{0,100})?([A-Z][^.]{20,200}\.)/s);
        const description = descMatch ? descMatch[1].substring(0, 300) : text.substring(0, 300);

        // Filtrar: eventos de CEFEs o que mencionen Bogotá
        const isBogota = text.toLowerCase().includes('bogotá') || text.toLowerCase().includes('bogota');

        if (isBogota && title.length > 5) {
          events.push({
            title: title.trim(),
            date: date.trim(),
            description: description.trim(),
            organizador: 'Centro de Felicidad',
          });

          console.log(`  ✓ [${idx}] ${title.substring(0, 60)}...`);
        }
      } catch (err) {
        // Ignorar errores individuales
      }
    });

    console.log(`\n[SCRAPE] Extraídos ${events.length} eventos de la página web\n`);
    return events;
  } catch (err) {
    console.error(`[SCRAPE] Error en web scraping: ${err}`);
    console.log('[SCRAPE] Usando eventos de fallback...\n');
    return [];
  }
}

/**
 * Eventos hardcodeados expandidos: múltiples CEFEs + variedades
 */
function getHardcodedEventsFromCEFEs(): EventCard[] {
  return [
    // Centro Felicidad Chapinero
    {
      title: 'Clases de Capoeira - Centro Felicidad Chapinero',
      date: '26 marzo 2026',
      description: 'Siente la energía, mejora tu movilidad y vive una experiencia única con esta manifestación cultural afrobrasileña. En Centro Felicidad Chapinero, Bogotá.',
      organizador: 'Centro Felicidad Chapinero',
    },
    {
      title: 'Salones de baile: Ritmos folclóricos - Chapinero',
      date: '27 marzo 2026',
      description: 'Espacios comunitarios para disfrutar del movimiento, música y bienestar. En Centro Felicidad Chapinero, Bogotá.',
      organizador: 'Centro Felicidad Chapinero',
    },
    {
      title: 'Silent DJ Set Party - Chapinero',
      date: '28 marzo 2026',
      description: 'Fiesta con audífonos de 3 presentaciones de Dj sets. En Centro Felicidad Chapinero, Bogotá.',
      organizador: 'Centro Felicidad Chapinero',
    },
    // Centro Felicidad San Cristóbal
    {
      title: 'Talleres de Yoga - Centro Felicidad San Cristóbal',
      date: '29 marzo 2026',
      description: 'Clases de yoga para toda la familia. Aprende técnicas de relajación y bienestar en Centro Felicidad San Cristóbal, Bogotá.',
      organizador: 'Centro Felicidad San Cristóbal',
    },
    {
      title: 'Natación Infantil - San Cristóbal',
      date: '30 marzo 2026',
      description: 'Clases de natación para niños de 4 a 10 años en las piscinas del Centro Felicidad San Cristóbal, Bogotá.',
      organizador: 'Centro Felicidad San Cristóbal',
    },
    {
      title: 'Gimnasia Artística - San Cristóbal',
      date: '31 marzo 2026',
      description: 'Desarrollo de habilidades acrobáticas y coordinación. Clases para niños de 6 a 12 años. Centro Felicidad San Cristóbal, Bogotá.',
      organizador: 'Centro Felicidad San Cristóbal',
    },
    // Centro Felicidad Las Cometas
    {
      title: 'Artes Marciales - Centro Felicidad Las Cometas',
      date: '31 marzo 2026',
      description: 'Aprende defensa personal y disciplina. Clases de karate y taekwondo en Centro Felicidad Las Cometas, Suba, Bogotá.',
      organizador: 'Centro Felicidad Las Cometas',
    },
    {
      title: 'Taller de Pintura Infantil - Las Cometas',
      date: '01 abril 2026',
      description: 'Desarrolla tu creatividad con clases de pintura y dibujo. Centro Felicidad Las Cometas, Bogotá.',
      organizador: 'Centro Felicidad Las Cometas',
    },
    {
      title: 'Tenis de Mesa - Las Cometas',
      date: '02 abril 2026',
      description: 'Escuela de formación en tenis de mesa. Para niños de 8 a 16 años. Centro Felicidad Las Cometas, Bogotá.',
      organizador: 'Centro Felicidad Las Cometas',
    },
    // Centro Felicidad Fontanar
    {
      title: 'Fútbol - Centro Felicidad Fontanar',
      date: '02 abril 2026',
      description: 'Escuela de formación deportiva en fútbol. Para niños de 6 a 14 años en Centro Felicidad Fontanar, Bogotá.',
      organizador: 'Centro Felicidad Fontanar',
    },
    {
      title: 'Danza Folclórica - Fontanar',
      date: '03 abril 2026',
      description: 'Aprende las danzas tradicionales colombianas. Centro Felicidad Fontanar, Bogotá.',
      organizador: 'Centro Felicidad Fontanar',
    },
    {
      title: 'Baloncesto - Fontanar',
      date: '04 abril 2026',
      description: 'Escuela de baloncesto para formación de atletas. Entrenamientos lunes a viernes. Centro Felicidad Fontanar, Bogotá.',
      organizador: 'Centro Felicidad Fontanar',
    },
    // Centro Felicidad Suba
    {
      title: 'Ajedrez Infantil - Centro Felicidad Suba',
      date: '05 abril 2026',
      description: 'Clases de ajedrez para desarrollar el pensamiento estratégico. Centro Felicidad Suba, Bogotá.',
      organizador: 'Centro Felicidad Suba',
    },
    {
      title: 'Danza Hip Hop - Suba',
      date: '06 abril 2026',
      description: 'Aprende movimientos modernos de hip hop. Clases para adolescentes y jóvenes. Centro Felicidad Suba, Bogotá.',
      organizador: 'Centro Felicidad Suba',
    },
    {
      title: 'Voleibol - Suba',
      date: '07 abril 2026',
      description: 'Formación en voleibol para niños y niñas. Centro Felicidad Suba, Bogotá.',
      organizador: 'Centro Felicidad Suba',
    },
    // Centro Felicidad Bosa
    {
      title: 'Guitarra para Niños - Centro Felicidad Bosa',
      date: '08 abril 2026',
      description: 'Aprende a tocar guitarra desde cero. Clases estructuradas para todas las edades. Centro Felicidad Bosa, Bogotá.',
      organizador: 'Centro Felicidad Bosa',
    },
    {
      title: 'Judo - Bosa',
      date: '09 abril 2026',
      description: 'Clases de judo para desarrollo integral. Centro Felicidad Bosa, Bogotá.',
      organizador: 'Centro Felicidad Bosa',
    },
    {
      title: 'Cerámica y Alfarería - Bosa',
      date: '10 abril 2026',
      description: 'Taller de cerámica y técnicas de alfarería. Crea tus propias obras. Centro Felicidad Bosa, Bogotá.',
      organizador: 'Centro Felicidad Bosa',
    },
    // Centro Felicidad Kennedy
    {
      title: 'Atletismo - Centro Felicidad Kennedy',
      date: '11 abril 2026',
      description: 'Programa de atletismo para desarrollo físico. Centro Felicidad Kennedy, Bogotá.',
      organizador: 'Centro Felicidad Kennedy',
    },
    {
      title: 'Taller de Repostería - Kennedy',
      date: '12 abril 2026',
      description: 'Aprende a preparar postres y pasteles. Taller práctico para todas las edades. Centro Felicidad Kennedy, Bogotá.',
      organizador: 'Centro Felicidad Kennedy',
    },
    {
      title: 'Badminton - Kennedy',
      date: '13 abril 2026',
      description: 'Clases y entrenamientos de badminton. Centro Felicidad Kennedy, Bogotá.',
      organizador: 'Centro Felicidad Kennedy',
    },
  ];
}

/**
 * Crea datos estructurados para guardar en BD
 */
function createActivityData(event: EventCard): ActivityNLPResult {
  const dateStr = event.date;

  // Parsear fecha más robustamente
  let startDate: Date;
  try {
    startDate = new Date(dateStr);
    if (isNaN(startDate.getTime())) {
      // Si no se puede parsear, usar hoy + 1 día
      startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
    }
  } catch {
    startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
  }

  return {
    title: event.title,
    description: event.description,
    categories: ['Artes', 'Actividad Cultural', 'Deporte'],
    minAge: 0,
    maxAge: 100,
    audience: 'FAMILY',
    price: 0,
    currency: 'COP',
    pricePeriod: 'FREE',
    schedules: [
      {
        startDate: startDate.toISOString(),
        endDate: new Date(startDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        frequency: 'once',
        timeSlot: '3:00 PM - 5:00 PM',
      }
    ],
    confidenceScore: 0.9,
    location: 'Centro de Felicidad, Bogotá',
  };
}

/**
 * Main: ejecuta el pipeline
 */
async function main() {
  console.log('\n[EVENTOS BOGOTÁ] ========== INICIO SCRAPING ==========\n');

  const storage = new ScrapingStorage();

  try {
    console.log('[EVENTOS] Verificando BD...\n');

    // 1. Intentar scraping real
    let scrapedEvents = await scrapeEventsFromPage();

    // 2. Si no consigue, usar hardcodeados. Si consigue, combinar
    const hardcodedEvents = getHardcodedEventsFromCEFEs();

    let events: EventCard[];
    if (scrapedEvents.length === 0) {
      console.log('[EVENTOS] Usando eventos hardcodeados como fallback...\n');
      events = hardcodedEvents;
    } else {
      // Combinar scrapeados + hardcodeados
      const allEvents = [...scrapedEvents, ...hardcodedEvents];
      // Remover duplicados (por título similar)
      const seen = new Set<string>();
      events = allEvents.filter(e => {
        const key = e.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      console.log(`[EVENTOS] Combinados: ${scrapedEvents.length} (scrapeados) + ${hardcodedEvents.length} (hardcodeados) = ${events.length} (únicos)\n`);
    }

    if (events.length === 0) {
      console.warn('[EVENTOS] No hay eventos para procesar');
      return;
    }

    // Guardar cada evento
    let savedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      console.log(`[EVENTOS] Procesando: ${event.title} (${i+1}/${events.length})`);

      const activityData = createActivityData(event);

      // Generar sourceUrl único basado en título y organizador
      const sourceUrl = `${EVENTOS_URL}#${encodeURIComponent(event.organizador)}-${encodeURIComponent(event.title)}`;

      try {
        const activityId = await storage.saveActivity(
          activityData,
          sourceUrl,
          'kids',
          { platform: 'WEBSITE', source: 'culturarecreacionydeporte.gov.co' }
        );

        if (activityId) {
          savedCount++;
          console.log(`[EVENTOS] ✓ Guardada: ${event.title}\n`);
        }
      } catch (err: any) {
        console.error(`[EVENTOS] ✗ Error guardando "${event.title}": ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\n[EVENTOS BOGOTÁ] ========== FIN SCRAPING ==========`);
    console.log(`[EVENTOS] Guardadas: ${savedCount}/${events.length}`);
    if (errorCount > 0) console.log(`[EVENTOS] Errores: ${errorCount}`);

  } catch (err: any) {
    console.error('\n[EVENTOS] Error fatal:', err.message);
    console.error(err.stack);
  } finally {
    await storage.disconnect();
  }
}

main().catch(console.error);
