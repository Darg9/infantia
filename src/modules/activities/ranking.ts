import { Activity } from '@/generated/prisma/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('activities:ranking');

export function getDomainFromUrl(url: string | null): string {
  if (!url) return '';
  try {
    const host = new URL(url).hostname;
    return host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Calcula los días transcurridos desde una fecha contra el bloque actual.
 */
function daysSince(date: Date): number {
  const diffTime = Math.abs(Date.now() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Recency Score:
 * Actividades más recientes inyectadas a DB se premian, dándole freshness
 * al ecosistema del listado.
 */
function computeRecencyScore(createdAt: Date): number {
  const days = daysSince(createdAt);

  if (days <= 3) return 1;
  if (days <= 7) return 0.8;
  if (days <= 30) return 0.5;
  return 0.2;
}

/**
 * Relevance Score:
 * Default base para integraciones futuras basadas en afinidad de usuario
 */
function computeRelevanceScore(activity: Partial<Activity>): number {
  // Inicial simple según requerimiento
  return 0.7;
}

/**
 * Mapeo oficial unificado para el Score global aplicable al listado en memoria.
 * ctrBoost es una señal aditiva real de comportamiento de usuario (máx +0.15).
 * NO reemplaza las señales existentes — las complementa.
 */
export function computeActivityScore(
  activity: Partial<Activity> & { _count?: { views?: number } & Record<string, number> },
  sourceHealthScore: number | undefined,
  ctrBoost: number = 0,
): number {
  const relevance = computeRelevanceScore(activity);
  const recency = computeRecencyScore(activity.createdAt || new Date());

  // Asumimos un score neutral (0.5) si el dominio aún no ha sido medido
  const trustScore = sourceHealthScore ?? 0.5;

  let rankingScore = (relevance * 0.5) + (recency * 0.2) + (trustScore * 0.3) + ctrBoost;

  // PRODUCT SIGNALS:
  // ⭐ Destacado (ha absorbido duplicados -> es confiable y deseable)
  const duplicates = activity.duplicatesCount ?? 0;
  if (duplicates > 0) {
    const cappedDuplicates = Math.min(duplicates, 5);
    rankingScore *= 1 + (cappedDuplicates * 0.02); // máx +10%
  }

  // 🛡️ Oficial (dominios verificados y seguros gubernamentales)
  const OFFICIAL_DOMAINS = [
    '.gov.co',
    'biblored.gov.co',
    'idartes.gov.co',
    'planetariodebogota.gov.co'
  ];
  const isOfficial = OFFICIAL_DOMAINS.some(d => activity.sourceDomain?.endsWith(d));
  rankingScore *= isOfficial ? 1.2 : 1;

  // 🔥 Popular (views boost)
  const views = activity._count?.views ?? 0;
  if (views > 0) {
    const cappedViews = Math.min(views, 20);
    rankingScore *= 1 + (cappedViews * 0.005); // máx +10% de boost por tráfico comprobado
  }

  // 🧩 Data Completeness Boost
  // Premia la existencia de campos clave sin penalizar a los que no lo tienen. Nivel máximo: +15%
  let completenessBoost = 1.0;
  if (activity.price !== null && typeof activity.price !== 'undefined') completenessBoost += 0.05;
  if (activity.ageMin !== null && typeof activity.ageMin !== 'undefined' || activity.ageMax !== null && typeof activity.ageMax !== 'undefined') completenessBoost += 0.05;
  if (activity.locationId !== null && typeof activity.locationId !== 'undefined') completenessBoost += 0.05;
  
  rankingScore *= completenessBoost;

  // ⏳ Decaimiento Temporal Suave (Freshness Decay)
  // Penaliza levemente a los eventos antiguos (independientemente de que hayan sido insertados ayer si el startDate es viejo)
  if (activity.startDate) {
    const daysSinceStart = daysSince(activity.startDate);
    const freshnessDecay = 1 - (daysSinceStart * 0.02);
    rankingScore *= Math.max(freshnessDecay, 0.8); // Drop máximo del 20%
  }

  return rankingScore;
}
