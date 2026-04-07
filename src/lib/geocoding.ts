// =============================================================================
// geocoding.ts — Geocoder con lookup de venues curados + Nominatim (fallback)
// Flujo: venue-dictionary → Nominatim → geocodeCityFallback → null
// Rate limit Nominatim: 1 req/seg según ToS.
// =============================================================================

import { lookupVenue } from './venue-dictionary';
import { createLogger } from './logger';

const log = createLogger('geocoding');

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'HabitaPlan/1.0 (plataforma de actividades infantiles; contacto@habitaplan.com)';
const RATE_LIMIT_MS = 1100; // 1.1s entre requests para respetar el ToS

let lastRequestAt = 0;

async function throttle() {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

/**
 * Geocodifica una dirección usando Nominatim.
 * @param address   Dirección principal (calle, barrio, etc.)
 * @param city      Nombre de la ciudad
 * @param country   País (default: 'Colombia')
 * @returns Coordenadas o null si no se encontró resultado
 */
export async function geocodeAddress(
  address: string,
  city: string,
  country = 'Colombia',
): Promise<GeocodingResult | null> {
  // 1. Buscar primero en el diccionario de venues curados (sin API call)
  const known = lookupVenue(address);
  if (known) {
    log.info('Venue conocido en diccionario', { name: known.name, lat: known.lat, lng: known.lng });
    return { latitude: known.lat, longitude: known.lng, displayName: known.name };
  }

  // 2. Fallback: Nominatim (OpenStreetMap)
  await throttle();

  // Construye la query — intenta dirección completa primero
  const query = [address, city, country].filter(Boolean).join(', ');

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'co');
  url.searchParams.set('addressdetails', '0');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'es',
      },
    });

    if (!res.ok) {
      log.error(`HTTP ${res.status} para query`, { query });
      return null;
    }

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      // Fallback: buscar solo por ciudad si la dirección no dio resultados
      return geocodeCityFallback(city, country);
    }

    const result = data[0];
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      displayName: result.display_name,
    };
  } catch (err) {
    log.error('Error de red en geocodeAddress', { query, error: err });
    return null;
  }
}

/**
 * Fallback: geocodifica solo la ciudad cuando la dirección falla.
 */
async function geocodeCityFallback(
  city: string,
  country: string,
): Promise<GeocodingResult | null> {
  await throttle();

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', `${city}, ${country}`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'co');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'es',
      },
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch {
    return null;
  }
}
