import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../../generated/prisma/client';
import { ActivityNLPResult, BatchPipelineResult } from './types';
import { calculateSimilarity, normalizeString } from './deduplication';
import { geocodeAddress } from '../../lib/geocoding';

// Prisma client propio para scripts standalone (no usa el singleton de Next.js)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type SaveResult = {
  saved: number;
  skipped: number;
  errors: string[];
};

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
  ): Promise<string | null> {
    try {
      // 1. Obtener vertical
      const vertical = await prisma.vertical.findUnique({ where: { slug: verticalSlug } });
      if (!vertical) {
        console.error(`[STORAGE] Vertical "${verticalSlug}" no encontrada. Ejecuta el seed primero.`);
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
        console.log(`[STORAGE] ⚠️ Duplicado detectado: "${data.title}" es similar a "${potentialDuplicate.title}"`);
        console.log(`          Reutilizando ID existente: ${potentialDuplicate.id}`);
        return potentialDuplicate.id;
      }

      // 4. Crear o actualizar Activity (upsert por sourceUrl)
      const existing = await prisma.activity.findFirst({
        where: { sourceUrl },
      });

      const activityData = {
        title: data.title.substring(0, 255),
        description: data.description || '',
        type: this.mapActivityType(data.categories),
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
        sourcePlatform: sourceOptions?.platform ?? 'WEBSITE',
        sourceConfidence: data.confidenceScore,
        sourceCapturedAt: new Date(),
      };

      // 4. Obtener o crear Location (con geocoding)
      let locationId: string | null = null;
      if (data.location?.address || data.location?.city) {
        const cityName = data.location.city || 'Bogotá';
        const locId = await this.getOrCreateLocation(
          data.location.address || cityName,
          cityName,
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
        console.log(`[STORAGE] Actualizada: "${data.title}" (${activityId})`);
      } else {
        const created = await prisma.activity.create({
          data: activityData,
        });
        activityId = created.id;
        console.log(`[STORAGE] Creada: "${data.title}" (${activityId})`);
      }

      // 5. Asociar categorías
      await this.linkCategories(activityId, data.categories, vertical.id);

      return activityId;
    } catch (error: any) {
      console.error(`[STORAGE] Error guardando "${data.title}":`, error.message);
      return null;
    }
  }

  /**
   * Guarda todos los resultados de un batch pipeline.
   */
  async saveBatchResults(batchResult: BatchPipelineResult): Promise<SaveResult> {
    const result: SaveResult = { saved: 0, skipped: 0, errors: [] };

    for (const item of batchResult.results) {
      if (!item.data) {
        result.skipped++;
        continue;
      }

      // Ignorar resultados con confianza muy baja
      if (item.data.confidenceScore < 0.2) {
        result.skipped++;
        continue;
      }

      const activityId = await this.saveActivity(item.data, item.url);
      if (activityId) {
        result.saved++;
      } else {
        result.errors.push(item.url);
      }
    }

    console.log(`[STORAGE] Batch: ${result.saved} guardadas, ${result.skipped} omitidas, ${result.errors.length} errores`);
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
   * Mapea categorías de Gemini a ActivityType del schema.
   */
  private mapActivityType(categories: string[]): 'RECURRING' | 'ONE_TIME' | 'CAMP' | 'WORKSHOP' {
    const lower = categories.map((c) => c.toLowerCase());
    if (lower.some((c) => c.includes('campamento'))) return 'CAMP';
    if (lower.some((c) => c.includes('taller'))) return 'WORKSHOP';
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

    for (const name of categoryNames) {
      const normalizedName = name.toLowerCase().trim();

      // Buscar match exacto o parcial
      const match = allCategories.find((c) => {
        const catName = c.name.toLowerCase();
        return catName === normalizedName || catName.includes(normalizedName) || normalizedName.includes(catName);
      });

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
      // Buscar la ciudad en BD
      const city = await prisma.city.findFirst({
        where: { name: { contains: cityName.split(',')[0].trim(), mode: 'insensitive' } },
      });
      if (!city) {
        // Intentar con Bogotá como fallback
        const bogota = await prisma.city.findFirst({ where: { name: { contains: 'Bogotá', mode: 'insensitive' } } });
        if (!bogota) return null;
        return this.getOrCreateLocation(address, 'Bogotá');
      }

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
        console.log(`[STORAGE] 📍 Geocodificado: "${address}" → [${geoResult.latitude.toFixed(4)}, ${geoResult.longitude.toFixed(4)}]`);
      } else {
        console.log(`[STORAGE] ⚠️ Sin coords para: "${address}" — guardado con lat/lng=0`);
      }

      return location.id;
    } catch (err: any) {
      console.error('[STORAGE] Error creando location:', err.message);
      return null;
    }
  }

  async disconnect(): Promise<void> {
    await prisma.$disconnect();
  }
}
