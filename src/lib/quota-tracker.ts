// quota-tracker.ts — Estado de cuota Gemini persistido en Redis
//
// Evita ejecuciones inútiles cuando la cuota está agotada.
// La key de Redis expira automáticamente cuando se estima que la cuota renovó.
//
// Uso:
//   if (!(await quota.isAvailable(apiKey))) { return; }
//   ...
//   // En el catch de 429:
//   await quota.markExhausted(apiKey);

import IORedis from 'ioredis';
import { createLogger } from './logger';

const log = createLogger('quota-tracker');

// Gemini Free Tier renueva a medianoche Pacific Time (PST = UTC-8 / PDT = UTC-7).
// En lugar de un TTL fijo de 6h (que causa reintentos inútiles antes del reset real),
// calculamos el próximo medianoche PST ≈ 07:00-08:00 UTC + 30min de margen.
const GEMINI_RESET_UTC_HOUR = 8; // medianoche PST (UTC-8) = 08:00 UTC, incluyendo margen PDT
const MIN_WAIT_HOURS = 1;         // espera mínima aunque la medianoche ya pasó hoy

function keyFor(apiKey: string): string {
  // Usa los últimos 8 chars como identificador — no guarda la key completa
  const suffix = apiKey.slice(-8) || 'unknown';
  return `quota:gemini:${suffix}`;
}

/**
 * Calcula el próximo momento en que la cuota de Gemini Free Tier se renovará.
 * Gemini reset ≈ medianoche PST = 08:00 UTC (con margen para PDT = 07:00 UTC).
 * Garantiza al menos MIN_WAIT_HOURS de espera para no reintentar demasiado pronto.
 */
function estimateReset(): Date {
  const now = new Date();
  const nowMs = now.getTime();

  // Próxima medianoche PST = próximo día a las GEMINI_RESET_UTC_HOUR:00 UTC
  const candidate = new Date(now);
  candidate.setUTCHours(GEMINI_RESET_UTC_HOUR, 0, 0, 0);

  // Si ya pasó la hora de reset hoy, usar mañana
  if (candidate.getTime() <= nowMs) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  // Garantizar espera mínima
  const minWaitMs = nowMs + MIN_WAIT_HOURS * 60 * 60 * 1000;
  return new Date(Math.max(candidate.getTime(), minWaitMs));
}

let _redis: IORedis | null = null;

function getRedis(): IORedis | null {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  _redis = new IORedis(url, { maxRetriesPerRequest: 3, enableReadyCheck: false, lazyConnect: true });
  return _redis;
}

/**
 * Devuelve la primera API key disponible del pool GEMINI_KEYS (o GOOGLE_AI_STUDIO_KEY como fallback).
 * Retorna null si todas están agotadas.
 */
export async function getAvailableKey(): Promise<string | null> {
  const raw = process.env.GEMINI_KEYS ?? process.env.GOOGLE_AI_STUDIO_KEY ?? '';
  const keys = raw.split(',').map((k) => k.trim()).filter(Boolean);

  for (const key of keys) {
    if (await quota.isAvailable(key)) return key;
  }

  if (keys.length === 0) {
    log.warn('No hay API keys de Gemini configuradas (GEMINI_KEYS o GOOGLE_AI_STUDIO_KEY).');
  } else {
    log.warn(`Todas las ${keys.length} keys de Gemini están agotadas.`);
  }
  return null;
}

export const quota = {
  async isAvailable(apiKey: string): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return true; // sin Redis → no bloquear

    try {
      const val = await redis.get(keyFor(apiKey));
      if (!val) return true;
      const resetAt = new Date(val);
      if (resetAt <= new Date()) {
        // Ya debería haber renovado — limpiar
        await redis.del(keyFor(apiKey));
        return true;
      }
      log.info(`Cuota agotada hasta ${resetAt.toISOString()}. Saltando llamada a Gemini.`);
      return false;
    } catch {
      return true; // si Redis falla → no bloquear
    }
  },

  async markExhausted(apiKey: string, resetAt?: Date): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    const reset = resetAt ?? estimateReset();
    const ttlSeconds = Math.ceil((reset.getTime() - Date.now()) / 1000);
    if (ttlSeconds <= 0) return;

    try {
      await redis.set(keyFor(apiKey), reset.toISOString(), 'EX', ttlSeconds);
      log.warn(`Cuota Gemini marcada como agotada hasta ${reset.toISOString()} (TTL ${ttlSeconds}s)`);
    } catch {
      // no-op — Redis error no debe bloquear el proceso
    }
  },

  async getResetAt(apiKey: string): Promise<Date | null> {
    const redis = getRedis();
    if (!redis) return null;

    try {
      const val = await redis.get(keyFor(apiKey));
      return val ? new Date(val) : null;
    } catch {
      return null;
    }
  },

  /**
   * Limpia el estado de cuota de todas las keys del pool en Redis.
   * Usar cuando se sabe que Google ya renovó la cuota (p.ej. después de las 8:00 UTC).
   */
  async clearAll(): Promise<number> {
    const redis = getRedis();
    if (!redis) return 0;

    const raw = process.env.GEMINI_KEYS ?? process.env.GOOGLE_AI_STUDIO_KEY ?? '';
    const keys = raw.split(',').map((k) => k.trim()).filter(Boolean);
    let cleared = 0;

    for (const key of keys) {
      try {
        const deleted = await redis.del(keyFor(key));
        if (deleted > 0) cleared++;
      } catch {
        // no-op
      }
    }

    return cleared;
  },
};
