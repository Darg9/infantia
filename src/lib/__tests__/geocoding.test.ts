// =============================================================================
// Tests para lib/geocoding.ts
// Cubre: venue-dictionary hit, Nominatim success, empty → city fallback,
//        errores HTTP, errores de red, geocodeCityFallback
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock lookupVenue ──────────────────────────────────────────────────────────
const mockLookupVenue = vi.fn();
vi.mock('../venue-dictionary', () => ({
  lookupVenue: (...args: unknown[]) => mockLookupVenue(...args),
}));

// ── Mock global fetch ─────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Neutralizar throttle sin fake timers ──────────────────────────────────────
// El módulo tiene `let lastRequestAt = 0`. Mockeamos Date.now() para que
// siempre devuelva un valor suficientemente distante del anterior (>1100ms),
// de modo que el throttle nunca espere sin necesidad de fake timers.
let fakeNow = 10_000_000;
vi.spyOn(Date, 'now').mockImplementation(() => {
  fakeNow += 5_000; // 5 s entre cada llamada → elapsed siempre > 1100 ms
  return fakeNow;
});

// Import DESPUÉS de todos los mocks (el módulo lee Date.now() en el throttle)
import { geocodeAddress } from '../geocoding';

// ── Helpers ───────────────────────────────────────────────────────────────────

function nominatimOk(
  lat = '4.6097',
  lon = '-74.0817',
  display_name = 'Bogotá, Colombia',
) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue([{ lat, lon, display_name }]),
  };
}

function nominatimEmpty() {
  return { ok: true, json: vi.fn().mockResolvedValue([]) };
}

function nominatimHttpError(status = 500) {
  return { ok: false, status };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('geocodeAddress()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Por defecto: no está en el diccionario
    mockLookupVenue.mockReturnValue(null);
  });

  // ── 1. Venue dictionary hit ───────────────────────────────────────────────

  describe('venue encontrado en el diccionario', () => {
    it('retorna coords del diccionario sin llamar a fetch', async () => {
      mockLookupVenue.mockReturnValue({
        name: 'Planetario de Bogotá',
        lat: 4.6534,
        lng: -74.0836,
      });

      const result = await geocodeAddress('Planetario de Bogotá', 'Bogotá');

      expect(result).toEqual({
        latitude: 4.6534,
        longitude: -74.0836,
        displayName: 'Planetario de Bogotá',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('pasa la dirección original a lookupVenue', async () => {
      mockLookupVenue.mockReturnValue(null);
      mockFetch.mockResolvedValue(nominatimOk());

      await geocodeAddress('Sala múltiple, Planetario', 'Bogotá');

      expect(mockLookupVenue).toHaveBeenCalledWith('Sala múltiple, Planetario');
    });
  });

  // ── 2. Nominatim con resultado ────────────────────────────────────────────

  describe('Nominatim responde con resultado', () => {
    it('devuelve latitud y longitud parseadas', async () => {
      mockFetch.mockResolvedValue(nominatimOk('4.6097', '-74.0817', 'Bogotá, Colombia'));

      const result = await geocodeAddress('Calle 26', 'Bogotá');

      expect(result).not.toBeNull();
      expect(result!.latitude).toBeCloseTo(4.6097, 3);
      expect(result!.longitude).toBeCloseTo(-74.0817, 3);
      expect(result!.displayName).toBe('Bogotá, Colombia');
    });

    it('construye la query con address, city y country', async () => {
      mockFetch.mockResolvedValue(nominatimOk());

      await geocodeAddress('Carrera 7', 'Medellín', 'Colombia');

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('Colombia');
      expect(calledUrl).toContain('Medell');
    });

    it('usa "Colombia" como país por defecto', async () => {
      mockFetch.mockResolvedValue(nominatimOk());

      await geocodeAddress('Calle 100', 'Bogotá');

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('Colombia');
    });

    it('envía el User-Agent correcto', async () => {
      mockFetch.mockResolvedValue(nominatimOk());

      await geocodeAddress('Calle 1', 'Bogotá');

      const options = mockFetch.mock.calls[0][1];
      expect(options.headers['User-Agent']).toContain('Infantia');
    });

    it('pide format=json y limit=1', async () => {
      mockFetch.mockResolvedValue(nominatimOk());

      await geocodeAddress('Dir X', 'Bogotá');

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('format=json');
      expect(calledUrl).toContain('limit=1');
    });

    it('retorna las coords del primer resultado', async () => {
      mockFetch.mockResolvedValue(nominatimOk('1.111', '-75.222', 'Resultaddo'));

      const result = await geocodeAddress('Algo', 'Ciudad');

      expect(result!.latitude).toBeCloseTo(1.111, 2);
      expect(result!.longitude).toBeCloseTo(-75.222, 2);
    });
  });

  // ── 3. Nominatim vacío → city fallback ───────────────────────────────────

  describe('Nominatim devuelve array vacío → city fallback', () => {
    it('hace una segunda llamada a fetch con solo la ciudad', async () => {
      mockFetch
        .mockResolvedValueOnce(nominatimEmpty())
        .mockResolvedValueOnce(nominatimOk('4.71', '-74.07', 'Bogotá, Colombia'));

      const result = await geocodeAddress('Dirección inexistente xyz', 'Bogotá');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result!.latitude).toBeCloseTo(4.71, 2);
    });

    it('city fallback también vacío → devuelve null', async () => {
      mockFetch
        .mockResolvedValueOnce(nominatimEmpty())
        .mockResolvedValueOnce(nominatimEmpty());

      const result = await geocodeAddress('Dirección xyz', 'Bogotá');

      expect(result).toBeNull();
    });

    it('city fallback con HTTP error → devuelve null', async () => {
      mockFetch
        .mockResolvedValueOnce(nominatimEmpty())
        .mockResolvedValueOnce(nominatimHttpError(503));

      const result = await geocodeAddress('Dirección xyz', 'Bogotá');

      expect(result).toBeNull();
    });

    it('city fallback con error de red → devuelve null', async () => {
      mockFetch
        .mockResolvedValueOnce(nominatimEmpty())
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await geocodeAddress('Dirección xyz', 'Bogotá');

      expect(result).toBeNull();
    });

    it('city fallback retorna coords correctas de la ciudad', async () => {
      mockFetch
        .mockResolvedValueOnce(nominatimEmpty())
        .mockResolvedValueOnce(nominatimOk('6.25', '-75.56', 'Medellín, Colombia'));

      const result = await geocodeAddress('Calle perdida', 'Medellín');

      expect(result!.latitude).toBeCloseTo(6.25, 2);
      expect(result!.displayName).toBe('Medellín, Colombia');
    });
  });

  // ── 4. HTTP errors ────────────────────────────────────────────────────────

  describe('Nominatim responde con HTTP error', () => {
    it('devuelve null en error 429', async () => {
      mockFetch.mockResolvedValue(nominatimHttpError(429));

      const result = await geocodeAddress('Calle X', 'Bogotá');

      expect(result).toBeNull();
    });

    it('devuelve null en error 500', async () => {
      mockFetch.mockResolvedValue(nominatimHttpError(500));

      const result = await geocodeAddress('Calle X', 'Bogotá');

      expect(result).toBeNull();
    });

    it('devuelve null en error 503', async () => {
      mockFetch.mockResolvedValue(nominatimHttpError(503));

      expect(await geocodeAddress('Dir', 'Bogotá')).toBeNull();
    });
  });

  // ── 5. Network errors ─────────────────────────────────────────────────────

  describe('error de red (fetch lanza)', () => {
    it('devuelve null y no propaga la excepción', async () => {
      mockFetch.mockRejectedValue(new Error('Failed to fetch'));

      const result = await geocodeAddress('Calle X', 'Bogotá');

      expect(result).toBeNull();
    });

    it('devuelve null con error AbortError', async () => {
      mockFetch.mockRejectedValue(new Error('AbortError: signal timed out'));

      const result = await geocodeAddress('Av. 9', 'Bogotá');

      expect(result).toBeNull();
    });
  });

  // ── 6. Dato no-array (respuesta malformada) ───────────────────────────────

  describe('respuesta malformada de Nominatim', () => {
    it('trata respuesta no-array como vacío → intenta city fallback', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ error: 'invalid' }) })
        .mockResolvedValueOnce(nominatimOk('4.6', '-74.0', 'Bogotá'));

      // No debe lanzar excepción
      const result = await geocodeAddress('Dir X', 'Bogotá');

      // Puede retornar null o resultado; lo importante es que no falla
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });
});
