// =============================================================================
// geocoding.ts — Geocoder via Nominatim (OpenStreetMap, sin API key)
// Rate limit: 1 req/seg según ToS de Nominatim.
// =============================================================================

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'Infantia/1.0 (plataforma de actividades infantiles; contacto@infantia.co)';
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
      console.error(`[geocoding] HTTP ${res.status} para "${query}"`);
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
    console.error('[geocoding] Error de red:', err);
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
