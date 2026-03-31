// =============================================================================
// GET /api/health — Health check del sistema
//
// Verifica conectividad con DB (PostgreSQL) y Redis.
// Útil para monitoreo externo (UptimeRobot, BetterUptime, etc.)
// y para verificar el estado antes de operaciones críticas.
//
// Respuestas:
//   200 { status: 'ok',       services: { db: 'ok',    redis: 'ok'    } }
//   503 { status: 'degraded', services: { db: 'error', redis: 'ok'    } }
//   503 { status: 'down',     services: { db: 'error', redis: 'error' } }
// =============================================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRedisConnection } from '@/modules/scraping/queue/connection';

export const dynamic = 'force-dynamic'; // nunca cachear — siempre checks en tiempo real

export async function GET() {
  const startedAt = Date.now();

  const services: Record<string, 'ok' | 'error'> = {
    db:    'error',
    redis: 'error',
  };

  // ── Check DB (PostgreSQL via Prisma) ─────────────────────────────────────
  try {
    await prisma.$queryRaw`SELECT 1`;
    services.db = 'ok';
  } catch {
    // DB no disponible — se reporta como error
  }

  // ── Check Redis (Upstash via IORedis) ─────────────────────────────────────
  try {
    const redis = getRedisConnection();
    const pong = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis timeout')), 3000),
      ),
    ]);
    if (pong === 'PONG') services.redis = 'ok';
  } catch {
    // Redis no disponible — se reporta como error
  }

  // ── Estado global ─────────────────────────────────────────────────────────
  const allOk    = Object.values(services).every((s) => s === 'ok');
  const allError = Object.values(services).every((s) => s === 'error');
  const status   = allOk ? 'ok' : allError ? 'down' : 'degraded';

  const httpStatus = status === 'ok' ? 200 : 503;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      services,
      version: process.env.npm_package_version ?? 'unknown',
    },
    { status: httpStatus },
  );
}
