import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../../generated/prisma/client';
import { ActivityNLPResult, BatchPipelineResult } from './types';
import { calculateSimilarity, normalizeString } from './deduplication';
import { geocodeAddress } from '../../lib/geocoding';
import { createLogger } from '../../lib/logger';
import { ambiguityScore } from './ambiguity';
import { getAdaptiveRules, getSourceRules } from './adaptive-rules';
import { runDataPipeline } from './data-pipeline';
import { matchCity } from '../../modules/geo/city-matcher';
import { queueCityReview } from '../../modules/geo/city-review';

const log = createLogger('scraping:storage');

// Prisma client propio para scripts standalone (no usa el singleton de Next.js)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type SaveResult = {
  saved: number;
  skipped: number;
  discarded: number;
  errors: string[];
};

type AdaptiveContext = {
  globalMetrics: { pctShort: number; pctNoise: number } | null;
  sourceHealthMap: Record<string, number>;
};

const EMPTY_ADAPTIVE_CTX: AdaptiveContext = { globalMetrics: null, sourceHealthMap: {} };

// Dominios que nunca deben almacenarse como fuente válida
const BLOCKED_DOMAINS = new Set([
  'agenciadigitalamd.com',
  'api.whatsapp.com', 'whatsapp.com',
  'telegram.me', 't.me',
  'linkedin.com', 'twitter.com', 'x.com', 'tiktok.com', 'facebook.com',
  'youtube.com', 'youtu.be', 'vimeo.com',
  'mercadolibre.com', 'amazon.com', 'rappi.com',
]);

// Mapa duro de dominios/cuentas a ciudades (bypass NLP)
// Fuentes abiertas (ej. FCE, BanRep con sedes múltiples) se omiten intencionalmente.
const HARDCODED_CITY_RULES: Array<{ match: (url: string, igUsername?: string) => boolean, city: string }> = [
  // --- Bogotá Oficial / Institucional ---
  { match: (url, _) => url.includes('bogota.gov.co'), city: 'Bogotá' },
  { match: (url, _) => url.includes('idartes.gov.co'), city: 'Bogotá' },
  { match: (url, _) => url.includes('biblored.gov.co'), city: 'Bogotá' },
  { match: (url, _) => url.includes('planetariodebogota.gov.co'), city: 'Bogotá' },
  { match: (url, _) => url.includes('cinematecadebogota.gov.co'), city: 'Bogotá' },
  { match: (url, _) => url.includes('culturarecreacionydeporte.gov.co'), city: 'Bogotá' },
  { match: (url, _) => url.includes('fuga.gov.co'), city: 'Bogotá' },
  { match: (url, _) => url.includes('jbb.gov.co'), city: 'Bogotá' },
  { match: (url, _) => url.includes('maloka.org'), city: 'Bogotá' },

  // --- Medellín ---
  { match: (_, ig) => ig === 'parqueexplora', city: 'Medellín' },
  { match: (_, ig) => ig === 'quehacerenmedellin', city: 'Medellín' },

  // --- Pasto ---
  { match: (_, ig) => ig === 'festiencuentro', city: 'Pasto' },

  // --- Bogotá Agregadores & Independientes ---
  { match: (_, ig) => ig === 'quehaypahacerenbogota', city: 'Bogotá' },
  { match: (_, ig) => ig === 'planesenbogotaa', city: 'Bogotá' },
  { match: (_, ig) => ig === 'plansitosbogota', city: 'Bogotá' },
  { match: (_, ig) => ig === 'bogotaplan', city: 'Bogotá' },
  { match: (_, ig) => ig === 'parchexbogota', city: 'Bogotá' },
  { match: (_, ig) => ig === 'bogotateatralycircense', city: 'Bogotá' },
  { match: (_, ig) => ig === 'teatropetra', city: 'Bogotá' },
  { match: (_, ig) => ig === 'centrodeljapon', city: 'Bogotá' },
];

function getHardcodedCity(sourceUrl: string, igUsername?: string): string | null {
  const urlLower = sourceUrl.toLowerCase();
  const igLower = igUsername?.toLowerCase();
  for (const rule of HARDCODED_CITY_RULES) {
    if (rule.match(urlLower, igLower)) {
      return rule.city;
    }
  }
  return null;
}


export class ScrapingStorage {
  /**
   * Guarda una actividad individual en la BD.
   * - Crea o reutiliza Provider basado en el hostname del sourceUrl
   * - Asocia categorías existentes por nombre (fuzzy match simple)
   * - Usa upsert por sourceUrl para evitar duplicados
   */
  async saveActivity(
    data: ActivityNLPResult,
    sourceUrl: string,
    verticalSlug: string = 'kids',
    sourceOptions?: { platform?: string; instagramUsername?: string },
    ctx: AdaptiveContext = EMPTY_ADAPTIVE_CTX,
  ): Promise<string | null> {
    try {
      // Rechazar dominios spam antes de cualquier procesamiento
      try {
        const hostname = new URL(sourceUrl).hostname.replace(/^www\./, '');
        if (BLOCKED_DOMAINS.has(hostname)) {
          log.warn(`[STORAGE] Dominio bloqueado rechazado: ${hostname} (${sourceUrl})`);
          return 'DISCARDED_BLOCKED_DOMAIN';
        }
      } catch { /* url inválida — dejar pasar, el pipeline lo rechazará */ }

      log.info('Data Pipeline Iniciado', { action: 'pipeline_process', result: 'attempt', sourceUrl });
      
      const pipeline = runDataPipeline(data);
      if (!pipeline.valid) {
        log.warn('Actividad descartada por pipeline', {
          action: 'pipeline_process',
          result: 'error',
          reason: pipeline.reason,
          ambiguityScore: ambiguityScore(data.description || ""),
          descriptionLength: data.description?.length || 0,
          title: data.title
        });
        return "DISCARDED_QUALITY";
      }

      log.info('Actividad supero pipeline de datos', { action: 'pipeline_process', result: 'success', title: pipeline.data.title });
      
      // Override natural data param with sanitized Pipeline Data Output
      data = pipeline.data;

      // Filtro adaptativo: ajusta minDescriptionLength según métricas globales + salud de la fuente
      if (data.description) {
        let domain = 'unknown';
        try { domain = new URL(sourceUrl).hostname.replace('www.', ''); } catch { /* url inválida */ }
        const sourceScore = ctx.sourceHealthMap[domain] ?? 0.5;
        const adaptiveRules = getAdaptiveRules(ctx.globalMetrics);
        const sourceRules = getSourceRules(sourceScore);
        const minLength = Math.max(adaptiveRules.minDescriptionLength, sourceRules.minDescriptionLength);
        if (data.description.length < minLength) {
          log.info(JSON.stringify({
            event: "activity_discarded_adaptive",
            domain,
            length: data.description.length,
            minLength,
            sourceScore,
            title: data.title,
          }));
          return "DISCARDED_QUALITY";
        }
      }

      // 1. Obtener vertical
      const vertical = await prisma.vertical.findUnique({ where: { slug: verticalSlug } });
      if (!vertical) {
        log.error(`Vertical "${verticalSlug}" no encontrada. Ejecuta el seed primero.`);
        return null;
      }

      // 2. Obtener o crear Provider
      const isInstagram = sourceOptions?.platform === 'INSTAGRAM';
      let provider;
      if (isInstagram && sourceOptions?.instagramUsername) {
        const igUsername = sourceOptions.instagramUsername;
        provider = await this.getOrCreateInstagramProvider(igUsername);
      } else {
        const hostname = new URL(sourceUrl).hostname.replace('www.', '');
        provider = await prisma.provider.upsert({
          where: { id: await this.getProviderIdByWebsite(hostname) },
          update: {},
          create: {
            name: hostname,
            type: 'INSTITUTION',
            website: `https://${hostname}`,
            description: `Proveedor auto-detectado desde ${hostname}`,
          },
        });
      }

      // 3. Detectar duplicados potenciales (por similitud)
      const potentialDuplicate = await this.findPotentialDuplicate(
        data.title,
        data.schedules?.[0]?.startDate
      );

      if (potentialDuplicate) {
        log.info(`⚠️ Duplicado detectado: "${data.title}" es similar a "${potentialDuplicate.title}"`);
        log.info(`          Reutilizando ID existente: ${potentialDuplicate.id}`);
        return potentialDuplicate.id;
      }

      // 4. Crear o actualizar Activity (upsert por sourceUrl)
      const existing = await prisma.activity.findFirst({
        where: { sourceUrl },
      });

      // Derivar sourceDomain desde la URL (necesario para health score + diversificación en portal)
      let sourceDomain: string | null = null;
      try { sourceDomain = new URL(sourceUrl).hostname.replace(/^www\./, ''); } catch { /* url inválida */ }

      const activityData = {
        title: data.title.substring(0, 255),
        description: data.description || '',
        type: this.mapActivityType(data.categories, data.title),
        status: 'ACTIVE' as const,
        startDate: data.schedules?.[0]?.startDate ? new Date(data.schedules[0].startDate) : null,
        endDate: data.schedules?.[0]?.endDate ? new Date(data.schedules[0].endDate) : null,
        schedule: data.schedules ? { items: data.schedules } : Prisma.JsonNull,
        ageMin: data.minAge ?? null,
        ageMax: data.maxAge ?? null,
        price: data.price != null ? data.price : null,
        priceCurrency: data.currency || 'COP',
        pricePeriod: data.pricePeriod ?? null,
        audience: (data.audience ?? 'ALL') as 'KIDS' | 'FAMILY' | 'ADULTS' | 'ALL',
        imageUrl: data.imageUrl ?? null,
        providerId: provider.id,
        verticalId: vertical.id,
        sourceType: 'SCRAPING' as const,
        sourceUrl,
        sourceDomain,
        sourcePlatform: sourceOptions?.platform ?? 'WEBSITE',
        sourceConfidence: data.confidenceScore,
        sourceCapturedAt: new Date(),
      };

      // 4. Obtener o crear Location (con geocoding y overrides fijos)
      let locationId: string | null = null;
      const hardcodedCity = getHardcodedCity(sourceUrl, sourceOptions?.instagramUsername);
      const resolvedCityStr = hardcodedCity || data.location?.city || 'Bogotá';
      const needsLocation = data.location?.address || hardcodedCity || data.location?.city;

      if (needsLocation) {
        // Fallback robusto: Si Gemini no extrajo dirección exacta pero tenemos ciudad (fija o NLP), 
        // usamos el nombre del proveedor en esa ciudad. Ej: "IDARTES", "Bogotá".
        const locNameStr = data.location?.address || provider.name;
        
        const locId = await this.getOrCreateLocation(
          locNameStr,
          resolvedCityStr,
        );
        locationId = locId;
      }

      if (locationId) {
        (activityData as any).locationId = locationId;
      }

      let activityId: string;

      if (existing) {
        // No sobreescribir imageUrl si ya existe (puede haber sido enriquecida por backfill)
        const updateData = existing.imageUrl
          ? { ...activityData, imageUrl: existing.imageUrl }
          : activityData;
        const updated = await prisma.activity.update({
          where: { id: existing.id },
          data: updateData,
        });
        activityId = updated.id;
        log.info(`Actualizada: "${data.title}" (${activityId})`);
      } else {
        const created = await prisma.activity.create({
          data: activityData,
        });
        activityId = created.id;
        log.info(`Creada: "${data.title}" (${activityId})`);
      }

      // 5. Asociar categorías
      await this.linkCategories(activityId, data.categories, vertical.id);

      return activityId;
    } catch (error: any) {
      log.error(`Error guardando "${data.title}":`, error.message);
      return null;
    }
  }

  /**
   * Guarda todos los resultados de un batch pipeline.
   */
  async saveBatchResults(batchResult: BatchPipelineResult): Promise<SaveResult> {
    const result: SaveResult = { saved: 0, skipped: 0, discarded: 0, errors: [] };

    // Cargar contexto adaptativo UNA sola vez para todo el batch
    const [globalMetrics, sourceHealthList] = await Promise.all([
      prisma.contentQualityMetric.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.sourceHealth.findMany({ select: { source: true, score: true } }),
    ]);
    const sourceHealthMap: Record<string, number> = {};
    for (const s of sourceHealthList) sourceHealthMap[s.source] = s.score;
    const ctx: AdaptiveContext = { globalMetrics, sourceHealthMap };

    for (const item of batchResult.results) {
      if (!item.data) {
        result.skipped++;
        continue;
      }

      // Threshold diferenciado: fallback Cheerio exige más para evitar ruido
      const saveThreshold = item.data.parserSource === 'fallback' ? 0.5 : 0.3;
      if (item.data.confidenceScore < saveThreshold) {
        result.skipped++;
        continue;
      }

      const activityId = await this.saveActivity(item.data, item.url, 'kids', undefined, ctx);
      if (activityId === "DISCARDED_QUALITY") {
        result.discarded++;
      } else if (activityId) {
        result.saved++;
      } else {
        result.errors.push(item.url);
      }
    }

    const total = result.saved + result.discarded + result.skipped;
    const discardRate = total > 0 ? Math.round((result.discarded / total) * 100) / 100 : 0;
    log.info(JSON.stringify({
      event: "adaptive_rules_applied",
      saved: result.saved,
      discarded: result.discarded,
      skipped: result.skipped,
      discardRate,
      errors: result.errors.length,
      sourceUrl: batchResult.sourceUrl,
      timestamp: new Date().toISOString(),
    }));

    // ── Trazabilidad: registrar funnel completo del run (fire-and-forget) ──────
    if (batchResult.sourceId) {
      void (async () => {
        try {
          await prisma.$executeRaw`
            INSERT INTO source_run_metrics
              (source_id, urls_scraped, urls_after_preflight,
               gemini_ok, fallback_count, activities_saved)
            VALUES
              (${batchResult.sourceId},
               ${batchResult.discoveredLinks},
               ${batchResult.filteredLinks},
               ${batchResult.parserMetrics?.geminiOk    ?? 0},
               ${batchResult.parserMetrics?.fallbackCount ?? 0},
               ${result.saved})
          `;
        } catch (err: unknown) {
          // Non-fatal — nunca rompe el pipeline
          log.warn('[storage] source_run_metrics insert fallido (non-fatal)', {
            sourceId: batchResult.sourceId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
    }

    return result;
  }

  /**
   * Get or create a Provider for an Instagram account.
   */
  private async getOrCreateInstagramProvider(username: string) {
    // Try to find by instagram field
    const existing = await prisma.provider.findFirst({
      where: { instagram: username },
    });
    if (existing) return existing;

    // Create new provider for this Instagram account
    return prisma.provider.create({
      data: {
        name: `@${username}`,
        type: 'INSTITUTION',
        instagram: username,
        website: `https://www.instagram.com/${username}/`,
        description: `Proveedor auto-detectado desde Instagram @${username}`,
      },
    });
  }

  /**
   * Busca un provider existente por website hostname, o retorna un ID temporal para upsert.
   */
  private async getProviderIdByWebsite(hostname: string): Promise<string> {
    const existing = await prisma.provider.findFirst({
      where: { website: { contains: hostname } },
    });
    return existing?.id ?? `temp-${hostname}`;
  }

  /**
   * Mapea el tipo de actividad (CAMP, WORKSHOP, RECURRING, ONE_TIME) combinando categorías nominales y el título.
   */
  private mapActivityType(categories: string[], title: string = ''): 'RECURRING' | 'ONE_TIME' | 'CAMP' | 'WORKSHOP' {
    const textContext = `${categories.join(' ')} ${title}`.toLowerCase();
    
    if (textContext.includes('campamento') || textContext.includes('vacacional') || textContext.includes('camp')) return 'CAMP';
    if (textContext.includes('taller') || textContext.includes('workshop')) return 'WORKSHOP';
    
    // La mayoría de actividades culturales/eventos son ONE_TIME
    return 'ONE_TIME';
  }

  /**
   * Asocia una actividad con categorías existentes en la BD.
   * Usa match parcial por nombre (case-insensitive).
   */
  private async linkCategories(activityId: string, categoryNames: string[], verticalId: string): Promise<void> {
    // Obtener todas las categorías de esta vertical
    const allCategories = await prisma.category.findMany({
      where: { verticalId },
    });

    for (const nameOrSlug of categoryNames) {
      const normalizedQuery = nameOrSlug.toLowerCase().trim();

      // Buscar match determinístico exacto (cero fuzzy matching o includes)
      const match = allCategories.find((c) => 
        c.slug === normalizedQuery || c.name.toLowerCase() === normalizedQuery
      );

      if (match) {
        // Upsert en la tabla intermedia
        try {
          await prisma.activityCategory.upsert({
            where: {
              activityId_categoryId: { activityId, categoryId: match.id },
            },
            update: {},
            create: { activityId, categoryId: match.id },
          });
        } catch {
          // Ignorar duplicados silenciosamente
        }
      }
    }
  }

  /**
   * Busca actividades potencialmente duplicadas por similitud de título
   * Si encuentra una con >75% de similitud y fecha cercana, la retorna
   */
  private async findPotentialDuplicate(
    title: string,
    startDate?: string,
  ): Promise<{ id: string; title: string } | null> {
    try {
      const normalizedTitle = normalizeString(title);

      // Obtener últimas 100 actividades (búsqueda rápida)
      const recent = await prisma.activity.findMany({
        select: { id: true, title: true, startDate: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      for (const existing of recent) {
        const existingNormalized = normalizeString(existing.title);
        const similarity = calculateSimilarity(normalizedTitle, existingNormalized);

        // Si >75% similar, considerar duplicado
        if (similarity > 75) {
          // Verificar que las fechas sean cercanas (dentro de 30 días)
          if (startDate && existing.startDate) {
            const newDate = new Date(startDate);
            const existingDate = new Date(existing.startDate);
            const daysDiff = Math.abs(newDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24);

            if (daysDiff <= 30) {
              return { id: existing.id, title: existing.title };
            }
          } else if (!startDate || !existing.startDate) {
            // Si alguna no tiene fecha, confiar en la similitud
            return { id: existing.id, title: existing.title };
          }
        }
      }

      return null;
    } catch {
      return null; // En caso de error, permitir crear la actividad
    }
  }

  /**
   * Obtiene o crea un registro Location para una dirección dada.
   * Geocodifica via Nominatim si no existe ya una location con esa dirección.
   */
  private async getOrCreateLocation(address: string, cityName: string): Promise<string | null> {
    try {
      // Matching canónico de ciudad (normalización + Levenshtein)
      const matchResult = await matchCity(cityName);

      let cityId: string | null = null;

      if (matchResult.status === 'MATCH') {
        cityId = matchResult.cityId;
      } else if (matchResult.status === 'REVIEW') {
        // Match probable → usar la sugerencia + encolar para revisión humana
        cityId = matchResult.suggestedCityId;
        queueCityReview({
          rawInput:        cityName,
          normalizedInput: matchResult.normalizedInput,
          suggestedCityId: matchResult.suggestedCityId,
          similarityScore: matchResult.score,
        });
        log.warn('[city-matcher] Ciudad en review — usando sugerida', {
          rawInput:  cityName,
          suggested: matchResult.suggestedCityId,
          score:     matchResult.score.toFixed(3),
        });
      } else {
        // NEW o sin confianza → encolar + fallback a Bogotá
        queueCityReview({
          rawInput:        cityName,
          normalizedInput: matchResult.normalizedInput,
          suggestedCityId: null,
          similarityScore: matchResult.score,
        });
        log.warn('[city-matcher] Ciudad desconocida — fallback Bogotá', {
          rawInput: cityName,
          score:    matchResult.score.toFixed(3),
        });
        const bogota = await prisma.city.findFirst({
          where: { name: { contains: 'Bogotá', mode: 'insensitive' } },
        });
        cityId = bogota?.id ?? null;
      }

      if (!cityId) return null;

      // Obtener city completo para geocoding
      const city = await prisma.city.findUnique({ where: { id: cityId } });
      if (!city) return null;

      // Buscar location existente con la misma dirección + ciudad
      const existing = await prisma.location.findFirst({
        where: { address, cityId: city.id },
      });
      if (existing) return existing.id;

      // Geocodificar
      const geoResult = await geocodeAddress(address, city.name);

      const location = await prisma.location.create({
        data: {
          name: address.substring(0, 255),
          address: address.substring(0, 500),
          cityId: city.id,
          latitude: geoResult?.latitude ?? 0,
          longitude: geoResult?.longitude ?? 0,
        },
      });

      if (geoResult) {
        log.info(`📍 Geocodificado: "${address}" → [${geoResult.latitude.toFixed(4)}, ${geoResult.longitude.toFixed(4)}]`);
      } else {
        log.info(`⚠️ Sin coords para: "${address}" — guardado con lat/lng=0`);
      }

      return location.id;
    } catch (err: any) {
      log.error('Error creando location:', err.message);
      return null;
    }
  }

  async disconnect(): Promise<void> {
    await prisma.$disconnect();
  }
}
