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
 */
export function computeActivityScore(
  activity: Partial<Activity>,
  sourceHealthScore: number | undefined
): number {
  const relevance = computeRelevanceScore(activity);
  const recency = computeRecencyScore(activity.createdAt || new Date());
  
  // Asumimos un score neutral (0.5) si el dominio aún no ha sido medido
  const trustScore = sourceHealthScore ?? 0.5;

  const rankingScore = (relevance * 0.5) + (recency * 0.2) + (trustScore * 0.3);

  return rankingScore;
}
