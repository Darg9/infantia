// =============================================================================
// Tests: src/lib/rate-limit.ts
//
// Estrategia de mock:
//   - ioredis mockeado con una clase real (new-compatible) en vi.mock factory
//   - exec controlado por vi.fn() accesible desde vi.hoisted()
//   - vi.resetModules() + dynamic import en cada test "con Redis" para
//     que _redis (singleton) parta de null en cada test
//   - REDIS_URL stubeada/destubeada con vi.stubEnv / vi.unstubAllEnvs
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock hoisted — solo exec necesita ser controlado por test ─────────────────

const mocks = vi.hoisted(() => ({
  exec: vi.fn(),
}));

vi.mock('ioredis', () => ({
  default: class MockIORedis {
    pipeline() {
      return {
        incr()   { return this; },
        expire() { return this; },
        exec: mocks.exec,
      };
    }
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONFIG = { keyPrefix: 'test', limit: 5, windowSecs: 60 };

function makeReq(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/test', { headers });
}

// ── 1. Sin REDIS_URL — fail-open ──────────────────────────────────────────────

describe('checkRateLimit — sin REDIS_URL (fail-open)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('devuelve allowed=true si REDIS_URL no está configurada', async () => {
    vi.resetModules();
    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('127.0.0.1', CONFIG);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(CONFIG.limit);
    expect(result.retryAfter).toBe(0);
    expect(mocks.exec).not.toHaveBeenCalled();
  });
});

// ── 2. Con Redis mockeado — pipeline ejecutado ────────────────────────────────
// Cada test reinicia el módulo para que _redis parta de null.

describe('checkRateLimit — con Redis mockeado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('REDIS_URL', 'redis://mock:6379');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('devuelve allowed=true cuando count <= limit', async () => {
    mocks.exec.mockResolvedValue([[null, 3]]);  // count=3 ≤ limit=5
    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('ip-ok', CONFIG);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);   // 5 - 3
    expect(result.retryAfter).toBe(0);
    expect(mocks.exec).toHaveBeenCalledOnce();
  });

  it('devuelve allowed=false y retryAfter>0 cuando count > limit', async () => {
    mocks.exec.mockResolvedValue([[null, 6]]);  // count=6 > limit=5
    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('ip-flood', CONFIG);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('devuelve FAIL_OPEN si pipeline.exec retorna null (sin resultados)', async () => {
    mocks.exec.mockResolvedValue(null);
    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('ip-null', CONFIG);

    expect(result.allowed).toBe(true);   // fail-open
    expect(result.remaining).toBe(CONFIG.limit);
  });

  it('devuelve FAIL_OPEN si el resultado tiene incrErr', async () => {
    mocks.exec.mockResolvedValue([[new Error('INCR failed'), null]]);
    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('ip-incr-err', CONFIG);

    expect(result.allowed).toBe(true);
  });

  it('devuelve FAIL_OPEN si pipeline.exec lanza excepción', async () => {
    mocks.exec.mockRejectedValue(new Error('Connection reset'));
    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('ip-crash', CONFIG);

    expect(result.allowed).toBe(true);   // catch → fail-open
  });

  it('remaining nunca es negativo aunque count supere el doble del límite', async () => {
    mocks.exec.mockResolvedValue([[null, 99]]);
    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('ip-storm', CONFIG);

    expect(result.remaining).toBe(0);   // Math.max(0, 5-99) = 0
    expect(result.allowed).toBe(false);
  });

  it('singleton: segunda llamada reutiliza la instancia Redis sin construir otra', async () => {
    mocks.exec.mockResolvedValue([[null, 1]]);
    const { checkRateLimit } = await import('../rate-limit');
    await checkRateLimit('ip-a', CONFIG);
    await checkRateLimit('ip-b', CONFIG);

    // exec llamado 2 veces (una por call), pero IORedis sólo se instancia 1 vez
    expect(mocks.exec).toHaveBeenCalledTimes(2);
  });
});

// ── 3. getIP ──────────────────────────────────────────────────────────────────

describe('getIP()', () => {
  let getIP: (req: NextRequest) => string;

  beforeEach(async () => {
    vi.resetModules();
    ({ getIP } = await import('../rate-limit'));
  });

  it('usa x-real-ip si está presente', () => {
    expect(getIP(makeReq({ 'x-real-ip': '1.2.3.4' }))).toBe('1.2.3.4');
  });

  it('usa el primer IP de x-forwarded-for si no hay x-real-ip', () => {
    expect(getIP(makeReq({ 'x-forwarded-for': '5.6.7.8, 9.10.11.12' }))).toBe('5.6.7.8');
  });

  it('recorta espacios del primer elemento de x-forwarded-for', () => {
    expect(getIP(makeReq({ 'x-forwarded-for': '  10.0.0.1  , 10.0.0.2' }))).toBe('10.0.0.1');
  });

  it('devuelve "anonymous" si no hay headers de IP', () => {
    expect(getIP(makeReq({}))).toBe('anonymous');
  });
});

// ── 4. rateLimitResponse ──────────────────────────────────────────────────────

describe('rateLimitResponse()', () => {
  let rateLimitResponse: (rl: import('../rate-limit').RateLimitResult) => Response;

  beforeEach(async () => {
    vi.resetModules();
    ({ rateLimitResponse } = await import('../rate-limit'));
  });

  it('devuelve status 429 con headers estándar de rate limit', async () => {
    const rl = { allowed: false, limit: 5, remaining: 0, retryAfter: 45 };
    const res = rateLimitResponse(rl);

    expect(res.status).toBe(429);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('Retry-After')).toBe('45');

    const body = await res.json();
    expect(body.error).toContain('Demasiadas solicitudes');
  });
});
