// =============================================================================
// GET /api/health — Health check del sistema
//
// Verifica conectividad con DB (PostgreSQL) y Redis con timeouts explícitos,
// y expone señal de negocio real con segmentación geográfica (Activity → City).
//
// Respuestas:
//   200 { status: 'ok' | 'degraded',
//         services:        { db: { status, latency_ms }, redis: { status, latency_ms } },
//         business_signal: { key, count, operational, stale,
//                            by_city: { bogota: { count, operational }, ... } } }
//   503 { status: 'down', ... }
//
// Reglas de fallo (smoke):
//   503                      → DB caída         → alerta crítica
//   operational = false      → sin contenido    → alerta crítica
//   stale = true             → ingesta parada   → log (no alerta, puede ser cuota Gemini)
//   by_city[x].operational   → solo observación → log (no falla pipeline)
//
// Segmentación geográfica: Activity → Location → City (JOIN SQL).
// Slug derivado de city.name normalizado: "Bogotá" → "bogota".
// =============================================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRedisConnection } from '@/modules/scraping/queue/connection';

export const dynamic = 'force-dynamic'; // nunca cachear — siempre checks en tiempo real

const DB_TIMEOUT_MS    = 2000;
const REDIS_TIMEOUT_MS = 2000;

type ServiceStatus = 'ok' | 'error' | 'timeout';
type ServiceResult = { status: ServiceStatus; latency_ms?: number };

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ]);
}

async function checkService(
  fn: () => Promise<unknown>,
  timeoutMs: number,
  label: string,
): Promise<ServiceResult> {
  const t0 = Date.now();
  try {
    await withTimeout(fn(), timeoutMs, label);
    return { status: 'ok', latency_ms: Date.now() - t0 };
  } catch (err) {
    const isTimeout = err instanceof Error && err.message.includes('timeout');
    return {
      status:     isTimeout ? 'timeout' : 'error',
      latency_ms: Date.now() - t0,
    };
  }
}

// Ingesta se considera "fresca" si hay actividades creadas en las últimas 48h.
// Si no → cron parado o cuota Gemini agotada.
const STALE_HOURS = 48;

export async function GET() {
  const startedAt = Date.now();
  const now       = new Date();

  // ── Checks en paralelo — tiempo total = max(db, redis, business), no suma ─
  const [dbResult, redisResult, businessSignal] = await Promise.all([
    checkService(() => prisma.$queryRaw`SELECT 1`, DB_TIMEOUT_MS, 'DB'),
    checkService(async () => {
      const redis = getRedisConnection();
      const pong  = await redis.ping();
      if (pong !== 'PONG') throw new Error('unexpected pong');
    }, REDIS_TIMEOUT_MS, 'Redis'),
    // Señal de negocio: actividades futuras disponibles + frescura de ingesta + por ciudad
    (async () => {
      try {
        const staleThreshold = new Date(now.getTime() - STALE_HOURS * 3_600_000);

        // Derivar slug de nombre de ciudad: "Bogotá" → "bogota", "Medellín" → "medellin"
        const toSlug = (name: string) =>
          name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_');

        const [futureCount, recentCount, cityRows] = await Promise.all([
          prisma.activity.count({ where: { startDate: { gte: now } } }),
          prisma.activity.count({ where: { createdAt: { gte: staleThreshold } } }),
          // JOIN Activity → Location → City para contar actividades futuras por ciudad
          prisma.$queryRaw<Array<{ city_name: string; count: bigint }>>`
            SELECT c.name AS city_name, COUNT(a.id)::bigint AS count
            FROM   activities a
            JOIN   locations  l ON l.id      = a.location_id
            JOIN   cities     c ON c.id      = l.city_id
            WHERE  a.start_date >= ${now}
            GROUP  BY c.id, c.name
          `,
        ]);

        // Construir mapa { slug → { count, operational } }
        const by_city: Record<string, { count: number; operational: boolean }> = {};
        for (const row of cityRows) {
          const slug  = toSlug(row.city_name);
          const count = Number(row.count);
          by_city[slug] = { count, operational: count > 0 };
        }

        return {
          key:         'activities' as const,
          count:       futureCount,
          operational: futureCount > 0,
          stale:       recentCount === 0,
          by_city,
        };
      } catch {
        // Si falla (DB down ya capturado por dbResult), devolver estado neutro
        return {
          key:         'activities' as const,
          count:       0,
          operational: false,
          stale:       true,
          by_city:     {} as Record<string, { count: number; operational: boolean }>,
        };
      }
    })(),
  ]);

  // ── Estado global ─────────────────────────────────────────────────────────
  const dbOk      = dbResult.status === 'ok';
  const dbTimeout = dbResult.status === 'timeout';
  const allOk     = dbOk && redisResult.status === 'ok';

  const status: 'ok' | 'degraded' | 'down' =
    allOk     ? 'ok'       :
    dbOk      ? 'degraded' :
    dbTimeout ? 'degraded' :
    'down';

  const httpStatus = status === 'down' ? 503 : 200;

  return NextResponse.json(
    {
      status,
      timestamp:      now.toISOString(),
      latency_ms:     Date.now() - startedAt,
      services: {
        db:    dbResult,
        redis: redisResult,
      },
      business_signal: businessSignal,
      version: process.env.npm_package_version ?? 'unknown',
    },
    { status: httpStatus },
  );
}
