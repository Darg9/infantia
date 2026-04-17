// =============================================================================
// city-matcher.ts — Matching de ciudad raw → City en BD
//
// Thresholds (ajustables sin tocar lógica):
//   >= THRESHOLD_AUTO   → match automático (retorna cityId)
//   >= THRESHOLD_REVIEW → match probable (retorna suggestedCityId + encola review)
//   <  THRESHOLD_REVIEW → sin match confiable (retorna null + encola review)
//
// Caché en memoria por sesión — ciudades son estáticas, sin TTL necesario.
// =============================================================================

import { prisma } from '../../lib/db';
import { normalizeCity, citySimilarity } from './city-normalizer';
import { createLogger } from '../../lib/logger';

const log = createLogger('geo:city-matcher');

// ── Thresholds ────────────────────────────────────────────────────────────────

export const THRESHOLD_AUTO   = 0.9;  // match automático
export const THRESHOLD_REVIEW = 0.75; // match probable → review

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type CityMatchResult =
  | { status: 'MATCH';  cityId: string;          score: number; normalizedInput: string }
  | { status: 'REVIEW'; suggestedCityId: string; score: number; normalizedInput: string }
  | { status: 'NEW';    score: number;            normalizedInput: string };

// ── Caché en memoria (estática por sesión) ────────────────────────────────────

type CityRow = { id: string; name: string };

let _cityCache: CityRow[] | null = null;

async function getCities(): Promise<CityRow[]> {
  if (_cityCache) return _cityCache;
  _cityCache = await prisma.city.findMany({
    where:  { isActive: true },
    select: { id: true, name: true },
  });
  return _cityCache;
}

/** Resetea caché — usar en tests o cuando se añadan ciudades en runtime. */
export function _resetCityCache(): void {
  _cityCache = null;
}

// ── matchCity ─────────────────────────────────────────────────────────────────

/**
 * Mapea un nombre de ciudad raw a la mejor ciudad en BD.
 *
 * @param rawCity  Nombre tal como viene del scraper (ej: "Bogotá D.C.")
 * @returns        CityMatchResult con status MATCH | REVIEW | NEW
 */
export async function matchCity(rawCity: string): Promise<CityMatchResult> {
  const normalizedInput = normalizeCity(rawCity);

  if (!normalizedInput) {
    log.warn('[city-matcher] rawCity vacío o no normalizable', { rawCity });
    return { status: 'NEW', score: 0, normalizedInput: '' };
  }

  const cities = await getCities();

  if (cities.length === 0) {
    log.warn('[city-matcher] No hay ciudades en BD');
    return { status: 'NEW', score: 0, normalizedInput };
  }

  // Buscar la mejor coincidencia
  let bestCity: CityRow = cities[0];
  let bestScore = 0;

  for (const city of cities) {
    const score = citySimilarity(normalizedInput, normalizeCity(city.name));
    if (score > bestScore) {
      bestScore = score;
      bestCity  = city;
    }
  }

  log.debug('[city-matcher] resultado', {
    rawCity,
    normalizedInput,
    bestMatch: bestCity.name,
    score:     bestScore.toFixed(3),
  });

  if (bestScore >= THRESHOLD_AUTO) {
    return { status: 'MATCH', cityId: bestCity.id, score: bestScore, normalizedInput };
  }

  if (bestScore >= THRESHOLD_REVIEW) {
    return { status: 'REVIEW', suggestedCityId: bestCity.id, score: bestScore, normalizedInput };
  }

  return { status: 'NEW', score: bestScore, normalizedInput };
}
