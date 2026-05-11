// =============================================================================
// Save Activity V2 — Pipeline V2 (no modifica V1)
//
// Responsabilidad: persistir una actividad con status ACTIVE o PENDING_REVIEW
// basado en la decisión del Gate V2. Registra snapshot en review_decisions.
//
// Diferencias vs V1 (storage.ts):
//   - Acepta el GateV2Result ya calculado → no recalcula gate internamente
//   - Status puede ser PENDING_REVIEW (nuevo) → queda invisible para usuarios
//   - Registra snapshot de análisis en review_decisions para auditoría y aprendizaje
//   - No llama a validateForPublish() (eso es lógica V1)
//
// El pipeline que llama esta función ya corrió: runDataPipeline, deduplicación,
// geocoding y provider lookup — igual que V1.
// =============================================================================

import { Prisma, PrismaClient, ActivityStatus } from '../../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ActivityNLPResult } from '../types';
import { GateV2Result } from '../quality/activity-gate-v2';
import { createLogger } from '../../../lib/logger';
import { geocodeAddress } from '../../../lib/geocoding';
import { matchCity } from '../../geo/city-matcher';
import { runDataPipeline } from '../data-pipeline';

const log = createLogger('scraping:storage-v2');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

export type SaveV2Action =
  | 'CREATED_ACTIVE'
  | 'CREATED_PENDING'
  | 'UPDATED_ACTIVE'
  | 'UPDATED_PENDING'
  | 'DEDUPE_SKIPPED'
  | 'DISCARDED'
  | 'ERROR';

export interface SaveV2Result {
  id: string | null;
  action: SaveV2Action;
  decision: 'ACTIVE' | 'PENDING_REVIEW' | 'DROP';
}

// Mapa duro de dominios a ciudades (mismo que V1)
const HARDCODED_CITY_MAP: Record<string, string> = {
  'bogota.gov.co':                    'Bogotá',
  'idartes.gov.co':                   'Bogotá',
  'biblored.gov.co':                  'Bogotá',
  'planetariodebogota.gov.co':        'Bogotá',
  'cinematecadebogota.gov.co':        'Bogotá',
  'culturarecreacionydeporte.gov.co': 'Bogotá',
  'fuga.gov.co':                      'Bogotá',
  'jbb.gov.co':                       'Bogotá',
  'maloka.org':                       'Bogotá',
  'banrepcultural.org':               'Bogotá',
  'fce.com.co':                       'Bogotá',
  'parqueexplora.org':                'Medellín',
};

function getHardcodedCity(domain: string): string | null {
  for (const [key, city] of Object.entries(HARDCODED_CITY_MAP)) {
    if (domain === key || domain.endsWith('.' + key)) return city;
  }
  return null;
}

function mapActivityType(categories: string[], title: string): string {
  const titleLower = title.toLowerCase();
  if (categories.some(c => ['Teatro', 'Danza', 'Música'].includes(c))) return 'RECURRING';
  if (titleLower.includes('taller') || titleLower.includes('curso') || titleLower.includes('clase')) return 'RECURRING';
  if (titleLower.includes('festival') || titleLower.includes('feria') || titleLower.includes('evento')) return 'ONE_TIME';
  return 'ONE_TIME';
}

/**
 * Guarda una actividad en el Pipeline V2.
 * El Gate V2 ya fue evaluado por el caller — aquí solo persistimos.
 */
export async function saveActivityV2(
  data: ActivityNLPResult,
  sourceUrl: string,
  gate: GateV2Result,
  options?: {
    instagramUsername?: string;
    platform?: string;
    verticalSlug?: string;
  },
): Promise<SaveV2Result> {
  if (gate.decision === 'DROP') {
    return { id: null, action: 'DISCARDED', decision: 'DROP' };
  }

  try {
    // ── 1. Data Pipeline (normalización, validación) ───────────────────────
    const pipeline = runDataPipeline(data);
    if (!pipeline.valid) {
      log.warn(`[V2:pipeline] Descartada: ${pipeline.reason} | "${data.title}"`);
      return { id: null, action: 'DISCARDED', decision: 'DROP' };
    }
    const normalized = pipeline.data;

    // ── 1b. Validación de fecha pasada (igual que publish_validator en V1) ──
    // Actividades con fecha de inicio > 60 días en el pasado → descartar
    if (normalized.schedules?.[0]?.startDate) {
      const startDate = new Date(normalized.schedules[0].startDate);
      const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 días atrás
      if (startDate < cutoff) {
        log.warn(`[V2:date] Descartada por fecha pasada: "${normalized.title}" | startDate=${normalized.schedules[0].startDate}`);
        return { id: null, action: 'DISCARDED', decision: 'DROP' };
      }
    }

    let domain = 'unknown';
    try { domain = new URL(sourceUrl).hostname.replace(/^www\./, ''); } catch { /* */ }

    // ── 2. Vertical ────────────────────────────────────────────────────────
    const verticalSlug = options?.verticalSlug ?? 'kids';
    const vertical = await prisma.vertical.findUnique({ where: { slug: verticalSlug } });
    if (!vertical) {
      log.error(`[V2] Vertical "${verticalSlug}" no encontrada`);
      return { id: null, action: 'ERROR', decision: gate.decision };
    }

    // ── 3. Provider ────────────────────────────────────────────────────────
    let provider;
    const isInstagram = options?.platform === 'INSTAGRAM';
    if (isInstagram && options?.instagramUsername) {
      provider = await prisma.provider.findFirst({ where: { instagram: options.instagramUsername } })
        ?? await prisma.provider.create({
          data: {
            name: `@${options.instagramUsername}`,
            type: 'INDEPENDENT',
            instagram: options.instagramUsername,
            description: `Cuenta de Instagram @${options.instagramUsername}`,
          },
        });
    } else {
      provider = await prisma.provider.upsert({
        where: { id: await getProviderIdByDomain(domain) },
        update: {},
        create: {
          name: domain,
          type: 'INSTITUTION',
          website: `https://${domain}`,
          description: `Auto-detectado desde ${domain}`,
        },
      });
    }

    // ── 4. Deduplicación rápida por sourceUrl ─────────────────────────────
    const existing = await prisma.activity.findFirst({ where: { sourceUrl } });

    // ── 5. Location ────────────────────────────────────────────────────────
    let locationId: string | null = null;
    const hardcodedCity = getHardcodedCity(domain);
    const cityName = hardcodedCity || normalized.location?.city || 'Bogotá';

    if (normalized.location?.address || hardcodedCity) {
      const address = normalized.location?.address || provider.name;
      locationId = await getOrCreateLocation(address, cityName);
    }

    // ── 6. Status ──────────────────────────────────────────────────────────
    const targetStatus: ActivityStatus =
      gate.decision === 'ACTIVE' ? ActivityStatus.ACTIVE : 'PENDING_REVIEW' as ActivityStatus;

    // ── 7. Actividad payload ───────────────────────────────────────────────
    const activityData = {
      title:           normalized.title.substring(0, 255),
      description:     normalized.description || '',
      type:            mapActivityType(normalized.categories, normalized.title) as 'ONE_TIME' | 'RECURRING',
      status:          targetStatus,
      startDate:       normalized.schedules?.[0]?.startDate ? new Date(normalized.schedules[0].startDate) : null,
      endDate:         normalized.schedules?.[0]?.endDate   ? new Date(normalized.schedules[0].endDate)   : null,
      schedule:        normalized.schedules ? { items: normalized.schedules } : Prisma.JsonNull,
      ageMin:          normalized.minAge ?? null,
      ageMax:          normalized.maxAge ?? null,
      price:           normalized.price != null ? normalized.price : null,
      priceCurrency:   normalized.currency || 'COP',
      pricePeriod:     normalized.pricePeriod ?? null,
      audience:        (normalized.audience ?? 'ALL') as 'KIDS' | 'FAMILY' | 'ADULTS' | 'ALL',
      imageUrl:        normalized.imageUrl ?? null,
      providerId:      provider.id,
      locationId:      locationId ?? undefined,
      verticalId:      vertical.id,
      sourceType:      'SCRAPING' as const,
      sourceUrl,
      sourceDomain:    domain,
      sourcePlatform:  options?.platform ?? 'WEBSITE',
      sourceConfidence: normalized.confidenceScore,
      sourceCapturedAt: new Date(),
      extractionMetadata: {
        mode: data.parserSource || 'gemini',
        pipelineVersion: 'v3',
        parser: data.parserSource === 'fallback' ? 'cheerio-fallback' : 'gemini-2.5-flash',
        parserVersion: '1.2.0',
        confidence: normalized.confidenceScore,
        fallbackUsed: data.parserSource === 'fallback',
        sourceUrl: sourceUrl,
        extractedAt: new Date().toISOString(),
        qualityTier: data.parserSource === 'fallback' ? 'degraded' : 'premium'
      } as Prisma.JsonObject,
    };

    // ── 8. Upsert actividad ────────────────────────────────────────────────
    let activityId: string;
    let action: SaveV2Action;

    if (existing) {
      // Preservar status si ya fue aprobado/rechazado manualmente
      const protectedStatuses: ActivityStatus[] = [
        ActivityStatus.ACTIVE,
        ActivityStatus.DRAFT,
        ActivityStatus.DUPLICATE,
      ];
      const finalStatus = protectedStatuses.includes(existing.status as ActivityStatus)
        ? existing.status as ActivityStatus
        : targetStatus;

      const updated = await prisma.activity.update({
        where: { id: existing.id },
        data: { ...activityData, status: finalStatus, imageUrl: existing.imageUrl || activityData.imageUrl },
      });
      activityId = updated.id;
      action = finalStatus === ActivityStatus.ACTIVE ? 'UPDATED_ACTIVE' : 'UPDATED_PENDING';
    } else {
      const created = await prisma.activity.create({ data: activityData });
      activityId = created.id;
      action = targetStatus === ActivityStatus.ACTIVE ? 'CREATED_ACTIVE' : 'CREATED_PENDING';
    }

    // ── 9. Categorías ──────────────────────────────────────────────────────
    await linkCategories(activityId, normalized.categories, vertical.id);

    // ── 10. Review decision snapshot (fire-and-forget) ─────────────────────
    void recordReviewDecision(activityId, domain, gate);

    log.info(
      `[V2] ${action}: "${normalized.title}" | status=${targetStatus} | gate=${gate.score.toFixed(2)} | source=${domain}`,
    );

    return { id: activityId, action, decision: gate.decision };
  } catch (err) {
    log.error(`[V2] Error guardando "${data.title}":`, { error: err instanceof Error ? err.message : String(err) });
    return { id: null, action: 'ERROR', decision: gate.decision };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getProviderIdByDomain(domain: string): Promise<string> {
  const p = await prisma.provider.findFirst({ where: { website: { contains: domain } } });
  return p?.id ?? 'nonexistent-id';
}

async function getOrCreateLocation(address: string, cityName: string): Promise<string | null> {
  try {
    const cityMatch = await matchCity(cityName);
    if (!cityMatch || cityMatch.status !== 'MATCH') return null;
    const cityId = cityMatch.cityId;

    const existing = await prisma.location.findFirst({
      where: { name: address.substring(0, 255), cityId },
    });
    if (existing) return existing.id;

    const geo = await geocodeAddress(address, cityName);
    const created = await prisma.location.create({
      data: {
        name:      address.substring(0, 255),
        address:   address.substring(0, 500),
        cityId,
        latitude:  geo?.latitude ?? 0,
        longitude: geo?.longitude ?? 0,
      },
    });
    return created.id;
  } catch {
    return null;
  }
}

async function linkCategories(
  activityId: string,
  categories: string[],
  verticalId: string,
): Promise<void> {
  try {
    await prisma.activityCategory.deleteMany({ where: { activityId } });
    for (const catName of categories) {
      const cat = await prisma.category.findFirst({
        where: { name: catName, verticalId },
      });
      if (cat) {
        await prisma.activityCategory.upsert({
          where: { activityId_categoryId: { activityId, categoryId: cat.id } },
          update: {},
          create: { activityId, categoryId: cat.id },
        });
      }
    }
  } catch { /* non-fatal */ }
}

async function recordReviewDecision(
  activityId: string,
  source: string,
  gate: GateV2Result,
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO review_decisions
         (activity_id, source, is_institutional, gate_score, gate_reason, gate_signals, source_trust)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       ON CONFLICT DO NOTHING`,
      activityId,
      source,
      gate.isInstitutional,
      gate.score,
      gate.reason,
      JSON.stringify(gate.signals),
      gate.sourceTrust,
    );
  } catch { /* best-effort */ }
}
