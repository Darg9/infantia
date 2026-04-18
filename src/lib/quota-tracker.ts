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

// Heurístico: cuota gratuita de Gemini renueva a medianoche PST ≈ 3am COL ≈ 8am UTC
const DEFAULT_RESET_HOURS = 6;

function keyFor(apiKey: string): string {
  // Usa los últimos 8 chars como identificador — no guarda la key completa
  const suffix = apiKey.slice(-8) || 'unknown';
  return `quota:gemini:${suffix}`;
}

function estimateReset(): Date {
  const now = new Date();
  const reset = new Date(now.getTime() + DEFAULT_RESET_HOURS * 60 * 60 * 1000);
  return reset;
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
};
