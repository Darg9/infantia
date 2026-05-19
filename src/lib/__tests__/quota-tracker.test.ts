// =============================================================================
// quota-tracker.test.ts — Tests unitarios para src/lib/quota-tracker.ts
//
// Estrategia: spy en quota.getRedis() para controlar Redis sin instancia real.
// Los tests cubren todas las ramas de decisión del módulo.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { quota, getAvailableKey } from '../quota-tracker';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockRedis() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  };
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  delete process.env.GEMINI_KEYS;
  delete process.env.GOOGLE_AI_STUDIO_KEY;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// =============================================================================
// estimateReset() — probado indirectamente via markExhausted()
// =============================================================================

describe('estimateReset() (via markExhausted)', () => {
  it('usa el mismo día a las 08:00 UTC si aún no son las 8', async () => {
    const mockDate = new Date(Date.UTC(2026, 3, 19, 7, 0, 0)); // 07:00 UTC
    vi.setSystemTime(mockDate);

    const redis = makeMockRedis();
    redis.set.mockResolvedValue('OK');
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);

    await quota.markExhausted('key00001'); // exactamente 8 chars → slice(-8) = 'key00001'

    const expectedReset = new Date(Date.UTC(2026, 3, 19, 8, 0, 0));
    const ttlSeconds = Math.ceil((expectedReset.getTime() - mockDate.getTime()) / 1000);
    expect(redis.set).toHaveBeenCalledWith(
      'quota:gemini:key00001',
      expectedReset.toISOString(),
      'EX',
      ttlSeconds,
    );
  });

  it('usa el día siguiente a las 08:00 UTC si ya pasaron las 8', async () => {
    const mockDate = new Date(Date.UTC(2026, 3, 19, 9, 0, 0)); // 09:00 UTC
    vi.setSystemTime(mockDate);

    const redis = makeMockRedis();
    redis.set.mockResolvedValue('OK');
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);

    await quota.markExhausted('key00001'); // exactamente 8 chars → slice(-8) = 'key00001'

    const expectedReset = new Date(Date.UTC(2026, 3, 20, 8, 0, 0)); // mañana
    const ttlSeconds = Math.ceil((expectedReset.getTime() - mockDate.getTime()) / 1000);
    expect(redis.set).toHaveBeenCalledWith(
      'quota:gemini:key00001',
      expectedReset.toISOString(),
      'EX',
      ttlSeconds,
    );
  });

  it('garantiza espera mínima de 1 hora aunque el reset de hoy ya pasó', async () => {
    // 07:30 UTC — el reset de las 08:00 es en 30 min, pero la espera mínima es 1h
    // El reset real quedaría en max(08:00, now+1h) = now+1h = 08:30
    const mockDate = new Date(Date.UTC(2026, 3, 19, 7, 30, 0));
    vi.setSystemTime(mockDate);

    const redis = makeMockRedis();
    redis.set.mockResolvedValue('OK');
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);

    await quota.markExhausted('key00001'); // exactamente 8 chars

    const [, storedIso, , ttl] = redis.set.mock.calls[0];
    const storedReset = new Date(storedIso);
    const minWait = mockDate.getTime() + 60 * 60 * 1000; // 1h mínimo
    expect(storedReset.getTime()).toBeGreaterThanOrEqual(minWait);
    expect(ttl).toBeGreaterThan(0);
  });
});

// =============================================================================
// isAvailable()
// =============================================================================

describe('quota.isAvailable()', () => {
  it('devuelve true cuando Redis no está disponible (getRedis → null)', async () => {
    vi.spyOn(quota, 'getRedis').mockReturnValue(null);
    expect(await quota.isAvailable('tkey1234')).toBe(true);
  });

  it('devuelve true cuando la key no existe en Redis (null)', async () => {
    const redis = makeMockRedis();
    redis.get.mockResolvedValue(null);
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);

    expect(await quota.isAvailable('tkey1234')).toBe(true);
    expect(redis.get).toHaveBeenCalledWith('quota:gemini:tkey1234');
  });

  it('devuelve false cuando la cuota está agotada y el reset es futuro', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 19, 7, 0, 0)));
    const redis = makeMockRedis();
    const future = new Date(Date.UTC(2026, 3, 19, 8, 0, 0)).toISOString();
    redis.get.mockResolvedValue(future);
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);

    expect(await quota.isAvailable('tkey1234')).toBe(false);
  });

  it('devuelve true y llama del cuando el reset ya expiró', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 19, 10, 0, 0)));
    const redis = makeMockRedis();
    const past = new Date(Date.UTC(2026, 3, 19, 8, 0, 0)).toISOString(); // 2h antes
    redis.get.mockResolvedValue(past);
    redis.del.mockResolvedValue(1);
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);

    expect(await quota.isAvailable('tkey1234')).toBe(true);
    expect(redis.del).toHaveBeenCalledWith('quota:gemini:tkey1234');
  });

  it('devuelve true (fail-open) si Redis.get lanza error', async () => {
    const redis = makeMockRedis();
    redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);

    expect(await quota.isAvailable('tkey1234')).toBe(true);
  });

  it('usa solo los últimos 8 caracteres de la key como suffix del identificador Redis', async () => {
    const redis = makeMockRedis();
    redis.get.mockResolvedValue(null);
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);

    await quota.isAvailable('ABCDEFGHIJKLMNOP'); // 16 chars
    expect(redis.get).toHaveBeenCalledWith('quota:gemini:IJKLMNOP');
  });
});

// =============================================================================
// markExhausted()
// =============================================================================

describe('quota.markExhausted()', () => {
  it('no hace nada cuando Redis no está disponible', async () => {
    vi.spyOn(quota, 'getRedis').mockReturnValue(null);
    await expect(quota.markExhausted('tkey1234')).resolves.toBeUndefined();
  });

  it('almacena la fecha de reset con TTL correcto', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 19, 7, 0, 0)));
    const redis = makeMockRedis();
    redis.set.mockResolvedValue('OK');
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);

    await quota.markExhausted('tkey1234');

    const [key, , ex, ttl] = redis.set.mock.calls[0];
    expect(key).toContain('quota:gemini:');
    expect(ex).toBe('EX');
    expect(ttl).toBeGreaterThan(0);
  });

  it('acepta un resetAt personalizado y lo usa directamente', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 19, 7, 0, 0)));
    const redis = makeMockRedis();
    redis.set.mockResolvedValue('OK');
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);

    const custom = new Date(Date.UTC(2026, 3, 19, 12, 0, 0));
    await quota.markExhausted('tkey1234', custom);

    const [, storedIso] = redis.set.mock.calls[0];
    expect(storedIso).toBe(custom.toISOString());
  });

  it('no llama set si el resetAt ya pasó (TTL <= 0)', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 19, 10, 0, 0)));
    const redis = makeMockRedis();
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);

    const pastDate = new Date(Date.UTC(2026, 3, 19, 9, 0, 0)); // 1h atrás
    await quota.markExhausted('tkey1234', pastDate);

    expect(redis.set).not.toHaveBeenCalled();
  });

  it('no lanza si Redis.set falla (fail-safe)', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 19, 7, 0, 0)));
    const redis = makeMockRedis();
    redis.set.mockRejectedValue(new Error('Redis write error'));
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);

    await expect(quota.markExhausted('tkey1234')).resolves.toBeUndefined();
  });
});

// =============================================================================
// getResetAt()
// =============================================================================

describe('quota.getResetAt()', () => {
  it('devuelve null cuando Redis no está disponible', async () => {
    vi.spyOn(quota, 'getRedis').mockReturnValue(null);
    expect(await quota.getResetAt('tkey1234')).toBeNull();
  });

  it('devuelve null cuando la key no existe en Redis', async () => {
    const redis = makeMockRedis();
    redis.get.mockResolvedValue(null);
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);

    expect(await quota.getResetAt('tkey1234')).toBeNull();
  });

  it('devuelve un Date cuando la key existe', async () => {
    const redis = makeMockRedis();
    const resetDate = new Date(Date.UTC(2026, 3, 20, 8, 0, 0));
    redis.get.mockResolvedValue(resetDate.toISOString());
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);

    const result = await quota.getResetAt('tkey1234');
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(resetDate.getTime());
  });

  it('devuelve null si Redis.get lanza error', async () => {
    const redis = makeMockRedis();
    redis.get.mockRejectedValue(new Error('Redis error'));
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);

    expect(await quota.getResetAt('tkey1234')).toBeNull();
  });
});

// =============================================================================
// clearAll()
// =============================================================================

describe('quota.clearAll()', () => {
  it('devuelve 0 cuando Redis no está disponible', async () => {
    vi.spyOn(quota, 'getRedis').mockReturnValue(null);
    expect(await quota.clearAll()).toBe(0);
  });

  it('devuelve 0 cuando no hay keys configuradas', async () => {
    const redis = makeMockRedis();
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);
    // sin GEMINI_KEYS ni GOOGLE_AI_STUDIO_KEY

    const cleared = await quota.clearAll();
    expect(cleared).toBe(0);
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('limpia todas las keys del pool y cuenta las eliminadas', async () => {
    const redis = makeMockRedis();
    redis.del
      .mockResolvedValueOnce(1) // keyA existía
      .mockResolvedValueOnce(0) // keyB no existía
      .mockResolvedValueOnce(1); // keyC existía
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);
    process.env.GEMINI_KEYS = 'keyA-12345678,keyB-12345678,keyC-12345678';

    const cleared = await quota.clearAll();
    expect(cleared).toBe(2);
    expect(redis.del).toHaveBeenCalledTimes(3);
  });

  it('usa GOOGLE_AI_STUDIO_KEY como fallback cuando no hay GEMINI_KEYS', async () => {
    const redis = makeMockRedis();
    redis.del.mockResolvedValue(1);
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);
    process.env.GOOGLE_AI_STUDIO_KEY = 'solo-key-abcdefgh';

    const cleared = await quota.clearAll();
    expect(cleared).toBe(1);
    expect(redis.del).toHaveBeenCalledTimes(1);
  });

  it('sigue ejecutando si una key falla (robustez)', async () => {
    const redis = makeMockRedis();
    redis.del
      .mockRejectedValueOnce(new Error('Redis error'))
      .mockResolvedValueOnce(1);
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);
    process.env.GEMINI_KEYS = 'keyA-12345678,keyB-12345678';

    const cleared = await quota.clearAll();
    expect(cleared).toBe(1); // solo la que no falló
  });
});

// =============================================================================
// getRemaining()
// =============================================================================

describe('quota.getRemaining()', () => {
  it('devuelve 0 cuando no hay keys configuradas', async () => {
    vi.spyOn(quota, 'getRedis').mockReturnValue(null);
    expect(await quota.getRemaining()).toBe(0);
  });

  it('devuelve 100 por cada key disponible (1 de 2 disponible)', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 19, 7, 0, 0)));
    const redis = makeMockRedis();
    const future = new Date(Date.UTC(2026, 3, 19, 8, 0, 0)).toISOString();
    redis.get
      .mockResolvedValueOnce(future)  // key 1: agotada
      .mockResolvedValueOnce(null);   // key 2: disponible
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);
    process.env.GEMINI_KEYS = 'key-aaaa1111,key-bbbb2222';

    expect(await quota.getRemaining()).toBe(100);
  });

  it('devuelve 200 cuando ambas keys están disponibles', async () => {
    const redis = makeMockRedis();
    redis.get.mockResolvedValue(null);
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);
    process.env.GEMINI_KEYS = 'key-aaaa1111,key-bbbb2222';

    expect(await quota.getRemaining()).toBe(200);
  });

  it('devuelve 0 cuando todas las keys están agotadas', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 19, 7, 0, 0)));
    const redis = makeMockRedis();
    const future = new Date(Date.UTC(2026, 3, 19, 8, 0, 0)).toISOString();
    redis.get.mockResolvedValue(future); // todas agotadas
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);
    process.env.GEMINI_KEYS = 'key-aaaa1111,key-bbbb2222';

    expect(await quota.getRemaining()).toBe(0);
  });
});

// =============================================================================
// getAvailableKey()
// =============================================================================

describe('getAvailableKey()', () => {
  it('devuelve null cuando no hay keys configuradas', async () => {
    vi.spyOn(quota, 'getRedis').mockReturnValue(null);
    expect(await getAvailableKey()).toBeNull();
  });

  it('devuelve la primera key disponible del pool', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 19, 7, 0, 0)));
    const redis = makeMockRedis();
    const future = new Date(Date.UTC(2026, 3, 19, 8, 0, 0)).toISOString();
    redis.get
      .mockResolvedValueOnce(future) // key 1: agotada
      .mockResolvedValueOnce(null);  // key 2: disponible
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);
    process.env.GEMINI_KEYS = 'key-aaaa1111,key-bbbb2222';

    const key = await getAvailableKey();
    expect(key).toBe('key-bbbb2222');
  });

  it('devuelve la primera key si está disponible (short-circuit)', async () => {
    const redis = makeMockRedis();
    redis.get.mockResolvedValue(null); // todas disponibles
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);
    process.env.GEMINI_KEYS = 'key-aaaa1111,key-bbbb2222';

    const key = await getAvailableKey();
    expect(key).toBe('key-aaaa1111');
    expect(redis.get).toHaveBeenCalledTimes(1); // short-circuits en la primera disponible
  });

  it('devuelve null cuando todas las keys están agotadas', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 19, 7, 0, 0)));
    const redis = makeMockRedis();
    const future = new Date(Date.UTC(2026, 3, 19, 8, 0, 0)).toISOString();
    redis.get.mockResolvedValue(future);
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);
    process.env.GEMINI_KEYS = 'key-aaaa1111,key-bbbb2222';

    expect(await getAvailableKey()).toBeNull();
  });

  it('usa GOOGLE_AI_STUDIO_KEY como fallback cuando no hay GEMINI_KEYS', async () => {
    const redis = makeMockRedis();
    redis.get.mockResolvedValue(null);
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);
    process.env.GOOGLE_AI_STUDIO_KEY = 'fallback-key-only';

    const key = await getAvailableKey();
    expect(key).toBe('fallback-key-only');
  });

  it('ignora entradas vacías en GEMINI_KEYS (espacios y comas extra)', async () => {
    const redis = makeMockRedis();
    redis.get.mockResolvedValue(null);
    vi.spyOn(quota, 'getRedis').mockReturnValue(redis as never);
    process.env.GEMINI_KEYS = ' , key-aaaa1111, , ';

    const key = await getAvailableKey();
    expect(key).toBe('key-aaaa1111');
    expect(redis.get).toHaveBeenCalledTimes(1); // solo la key real
  });
});
