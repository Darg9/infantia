// =============================================================================
// rate-limit.ts — Rate limiting HTTP de ventana fija con Redis
//
// Algoritmo: Fixed-window counter.
//   key = rl:{prefix}:{identifier}:{floor(now / windowSecs)}
//   INCR + EXPIRE (pipeline) → atómico, TTL se aplica en el primer hit.
//
// Fail-open: si Redis no está disponible, la solicitud se permite (nunca bloquea).
//
// Uso típico en una ruta Next.js:
//   const rl = await checkRateLimit(getIP(req), RATE_LIMITS.contact);
//   if (!rl.allowed) return rateLimitResponse(rl);
// =============================================================================

import IORedis from 'ioredis';
import { NextRequest, NextResponse } from 'next/server';

let _redis: IORedis | null = null;

function getRedis(): IORedis | null {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  _redis = new IORedis(url, {
    maxRetriesPerRequest: 1,   // falla rápido — no bloquear el request
    enableReadyCheck:    false,
    lazyConnect:         true,
  });
  return _redis;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Nombre del límite (parte de la clave Redis) */
  keyPrefix:   string;
  /** Máximo de requests permitidos en la ventana */
  limit:       number;
  /** Duración de la ventana en segundos */
  windowSecs:  number;
}

export interface RateLimitResult {
  allowed:    boolean;
  limit:      number;
  remaining:  number;
  /** Segundos hasta el reset de la ventana actual (0 si allowed) */
  retryAfter: number;
}

// ── Límites predefinidos ──────────────────────────────────────────────────────

export const RATE_LIMITS = {
  /** Formulario de contacto — dispara emails Resend (costo real) */
  contact: {
    keyPrefix:  'contact',
    limit:       5,
    windowSecs:  3600, // 5 req/hora
  },
  /** Endpoint de tracking de eventos — alta frecuencia, low risk */
  events: {
    keyPrefix:  'events',
    limit:       120,
    windowSecs:  60,   // 120 req/min
  },
  /** Logging de búsquedas — analytics */
  searchLog: {
    keyPrefix:  'search_log',
    limit:       60,
    windowSecs:  60,   // 60 req/min
  },
  /** Calificaciones de actividades — autenticado, limitar abuso */
  ratings: {
    keyPrefix:  'ratings',
    limit:       20,
    windowSecs:  3600, // 20 req/hora
  },
} satisfies Record<string, RateLimitConfig>;

// ── Core ──────────────────────────────────────────────────────────────────────

/**
 * Verifica si el `identifier` (IP o userId) puede continuar.
 * Siempre fail-open: si Redis no responde, devuelve `allowed: true`.
 */
export async function checkRateLimit(
  identifier:  string,
  config:       RateLimitConfig,
): Promise<RateLimitResult> {
  const redis = getRedis();
  const FAIL_OPEN: RateLimitResult = {
    allowed:    true,
    limit:      config.limit,
    remaining:  config.limit,
    retryAfter: 0,
  };

  if (!redis) return FAIL_OPEN;

  const nowSecs = Math.floor(Date.now() / 1000);
  const window  = Math.floor(nowSecs / config.windowSecs);
  const key     = `rl:${config.keyPrefix}:${identifier}:${window}`;

  try {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, config.windowSecs);
    const results = await pipeline.exec();

    if (!results) return FAIL_OPEN;

    const [incrErr, count] = results[0] as [Error | null, number];
    if (incrErr) return FAIL_OPEN;

    const allowed    = count <= config.limit;
    const remaining  = Math.max(0, config.limit - count);
    const windowEnd  = (window + 1) * config.windowSecs;
    const retryAfter = allowed ? 0 : Math.ceil(windowEnd - nowSecs);

    return { allowed, limit: config.limit, remaining, retryAfter };
  } catch {
    return FAIL_OPEN;
  }
}

/**
 * Extrae el identificador de IP del request (Vercel-safe).
 * Toma el primer elemento de x-forwarded-for o x-real-ip.
 */
export function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'anonymous'
  );
}

/**
 * Devuelve una respuesta 429 con headers estándar de rate limit.
 */
export function rateLimitResponse(rl: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: 'Demasiadas solicitudes. Por favor intenta más tarde.' },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit':     String(rl.limit),
        'X-RateLimit-Remaining': '0',
        'Retry-After':           String(rl.retryAfter),
      },
    },
  );
}
