import { test, expect } from '@playwright/test';

// =============================================================================
// Health endpoint — smoke test
//
// Valida que /api/health devuelve un payload estructurado con:
//   - HTTP 200 (app sirve tráfico)
//   - status: ok | degraded  (nunca 'down' en entorno de test/prod sano)
//   - services.db.status: ok
//   - business_signal.operational: true (hay actividades futuras disponibles)
//   - business_signal.by_city: mapa ciudad → { count, operational }
//
// Si business_signal.operational = false → el producto no tiene contenido útil.
// Si business_signal.stale = true       → ingesta parada (cron o cuota Gemini).
// by_city[x].operational = false        → solo observación, no falla pipeline.
// =============================================================================

test.describe('GET /api/health', () => {
  test('devuelve 200 con estructura completa', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.status()).toBe(200);

    const json = await response.json();

    // Campos raíz
    expect(json).toHaveProperty('status');
    expect(['ok', 'degraded']).toContain(json.status);
    expect(json).toHaveProperty('timestamp');
    expect(json).toHaveProperty('latency_ms');
    expect(typeof json.latency_ms).toBe('number');

    // Services
    expect(json.services).toHaveProperty('db');
    expect(json.services).toHaveProperty('redis');
    expect(json.services.db).toHaveProperty('status');
    expect(json.services.db).toHaveProperty('latency_ms');

    // Business signal presente y con shape correcto
    expect(json).toHaveProperty('business_signal');
    expect(json.business_signal.key).toBe('activities');
    expect(typeof json.business_signal.count).toBe('number');
    expect(typeof json.business_signal.operational).toBe('boolean');
    expect(typeof json.business_signal.stale).toBe('boolean');

    // by_city: mapa slug → { count, operational }
    // Falla pipeline solo si global.operational = false; por ciudad es observación.
    expect(json.business_signal).toHaveProperty('by_city');
    expect(typeof json.business_signal.by_city).toBe('object');
    for (const [slug, cityData] of Object.entries<{ count: number; operational: boolean }>(
      json.business_signal.by_city,
    )) {
      expect(typeof slug).toBe('string');
      expect(typeof cityData.count).toBe('number');
      expect(typeof cityData.operational).toBe('boolean');
      if (!cityData.operational) {
        console.warn(`[health] by_city.${slug}: operational=false (sin actividades futuras)`);
      }
    }
  });

  test('DB responde correctamente (services.db.status = ok)', async ({ request }) => {
    const response = await request.get('/api/health');
    const json = await response.json();

    expect(json.services.db.status).toBe('ok');
  });

  test('producto tiene actividades futuras (business_signal.operational = true)', async ({ request }) => {
    const response = await request.get('/api/health');
    const json = await response.json();

    expect(json.business_signal.operational).toBe(true);
  });

  test('la ingesta no está congelada (business_signal.stale = false)', async ({ request }) => {
    const response = await request.get('/api/health');
    const json = await response.json();

    // Si stale = true: el cron lleva > 48h sin generar actividades nuevas.
    // Puede ser cuota Gemini agotada o scheduler caído.
    expect(json.business_signal.stale).toBe(false);
  });

  test('latencia total < 3000ms', async ({ request }) => {
    const response = await request.get('/api/health');
    const json = await response.json();

    expect(json.latency_ms).toBeLessThan(3000);
  });
});
