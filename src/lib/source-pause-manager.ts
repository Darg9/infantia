// source-pause-manager.ts
// Gestiona la pausa automática de fuentes según URL score
// Configurable por: general (default), ciudad, fuente específica

import { prisma } from './db';
import { createLogger } from './logger';

const log = createLogger('source-pause-manager');

/**
 * Configuración global de pause (fallback)
 * IMPORTANTE: These can be overridden per city or per source
 */
export const GLOBAL_PAUSE_CONFIG = {
  threshold: 20, // score < 20 → pausar
  durationDays: 7, // duración del pause
  enabled: true,
};

/**
 * Configuración por ciudad (overrides global)
 * Las claves deben ser nombres de ciudad en minúsculas
 */
export const CITY_PAUSE_CONFIG: Record<string, { threshold?: number; durationDays?: number; enabled?: boolean }> = {
  // Ejemplos:
  // 'bogotá': { threshold: 25, durationDays: 14 },
  // 'medellín': { threshold: 15, durationDays: 5 },
};

/**
 * Resolva la configuración de pause aplicable a una fuente
 * Priority: SourceSpecific > City > Global
 */
export async function resolvePauseConfig(sourceId: string, cityId?: string) {
  // 1. Buscar config específica de fuente + ciudad
  if (cityId && sourceId) {
  type PauseConfigRow = { pause_threshold_score: number; pause_duration_days: number; auto_pause_enabled: boolean };
    const sourceConfig = await prisma.$queryRawUnsafe<PauseConfigRow[]>(
      `SELECT pause_threshold_score, pause_duration_days, auto_pause_enabled
       FROM source_pause_config
       WHERE source_id = $1 AND city_id = $2
       LIMIT 1`,
      sourceId,
      cityId,
    );
    if (sourceConfig && sourceConfig.length > 0) {
      return {
        threshold: sourceConfig[0].pause_threshold_score,
        durationDays: sourceConfig[0].pause_duration_days,
        enabled: sourceConfig[0].auto_pause_enabled,
        level: 'source_city',
      };
    }
  }

  // 2. Buscar config específica de fuente (sin city)
  if (sourceId) {
  type PauseConfigRow = { pause_threshold_score: number; pause_duration_days: number; auto_pause_enabled: boolean };
    const sourceConfig = await prisma.$queryRawUnsafe<PauseConfigRow[]>(
      `SELECT pause_threshold_score, pause_duration_days, auto_pause_enabled
       FROM source_pause_config
       WHERE source_id = $1 AND city_id IS NULL
       LIMIT 1`,
      sourceId,
    );
    if (sourceConfig && sourceConfig.length > 0) {
      return {
        threshold: sourceConfig[0].pause_threshold_score,
        durationDays: sourceConfig[0].pause_duration_days,
        enabled: sourceConfig[0].auto_pause_enabled,
        level: 'source',
      };
    }
  }

  // 3. Buscar config por ciudad
  if (cityId) {
    const city = await prisma.city.findUnique({ where: { id: cityId } });
    if (city && CITY_PAUSE_CONFIG[city.name.toLowerCase()]) {
      const cityConfig = CITY_PAUSE_CONFIG[city.name.toLowerCase()];
      return {
        threshold: cityConfig.threshold ?? GLOBAL_PAUSE_CONFIG.threshold,
        durationDays: cityConfig.durationDays ?? GLOBAL_PAUSE_CONFIG.durationDays,
        enabled: cityConfig.enabled ?? GLOBAL_PAUSE_CONFIG.enabled,
        level: 'city',
      };
    }
  }

  // 4. Fallback a config global
  return {
    threshold: GLOBAL_PAUSE_CONFIG.threshold,
    durationDays: GLOBAL_PAUSE_CONFIG.durationDays,
    enabled: GLOBAL_PAUSE_CONFIG.enabled,
    level: 'global',
  };
}

/**
 * Calcula el score agregado de URLs para una fuente
 * Basado en últimos logs de scraping
 */
export async function calculateSourceScore(sourceId: string, cityId?: string, weeksBack = 1) {
  const sinceDatetime = new Date(Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000);

  // Obtener logs recientes
  const logs = await prisma.$queryRawUnsafe<
    Array<{ avg_score: number | null; total_urls: number; low_score_urls: number }>
  >(
    `
    SELECT
      AVG(CAST(metadata->>'avg_url_score' AS FLOAT)) as avg_score,
      COUNT(DISTINCT id) as total_urls,
      COUNT(CASE WHEN CAST(metadata->>'avg_url_score' AS FLOAT) < 45 THEN 1 END) as low_score_urls
    FROM scraping_log
    WHERE source_id = $1
      AND city_id = $2
      AND started_at >= $3
      AND status IN ('SUCCESS', 'PARTIAL')
  `,
    sourceId,
    cityId,
    sinceDatetime,
  );

  if (!logs || logs.length === 0) {
    return { avgScore: null, lowScoreCount: 0, totalUrls: 0, hasData: false };
  }

  const log_data = logs[0];
  return {
    avgScore: log_data.avg_score ? Math.round(parseFloat(String(log_data.avg_score)) * 10) / 10 : null,
    lowScoreCount: Number(log_data.low_score_urls || 0),
    totalUrls: Number(log_data.total_urls || 0),
    hasData: true,
  };
}

/**
 * Pausa una fuente automáticamente si score < threshold
 */
export async function pauseSourceIfNeeded(sourceId: string, cityId?: string) {
  const config = await resolvePauseConfig(sourceId, cityId);

  if (!config.enabled) {
    log.info(`Auto-pause disabled for source ${sourceId} at level: ${config.level}`);
    return { paused: false, reason: 'auto_pause_disabled' };
  }

  const score = await calculateSourceScore(sourceId, cityId, 1);

  if (!score.hasData) {
    log.warn(`No data available to calculate score for source ${sourceId}`);
    return { paused: false, reason: 'no_data', score: score.avgScore };
  }

  if (score.avgScore === null || score.avgScore >= config.threshold) {
    log.info(`Source ${sourceId} score ${score.avgScore} >= threshold ${config.threshold} — no action`);
    return { paused: false, reason: 'score_above_threshold', score: score.avgScore };
  }

  // Score está por debajo del threshold — pausar
  const reason = `Auto-paused: URL score ${score.avgScore} < ${config.threshold} (config level: ${config.level})`;
  const pauseUntil = new Date(Date.now() + config.durationDays * 24 * 60 * 60 * 1000);

  // Actualizar config de pause
  if (cityId) {
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO source_pause_config (source_id, city_id, pause_threshold_score, pause_duration_days, paused_at, paused_reason)
      VALUES ($1, $2, $3, $4, NOW(), $5)
      ON CONFLICT (source_id, city_id) DO UPDATE SET
        paused_at = NOW(),
        paused_reason = $5,
        updated_at = NOW()
      `,
      sourceId,
      cityId,
      config.threshold,
      config.durationDays,
      reason,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO source_pause_config (source_id, city_id, pause_threshold_score, pause_duration_days, paused_at, paused_reason)
      VALUES ($1, NULL, $2, $3, NOW(), $4)
      ON CONFLICT (source_id, city_id) DO UPDATE SET
        paused_at = NOW(),
        paused_reason = $4,
        updated_at = NOW()
      `,
      sourceId,
      config.threshold,
      config.durationDays,
      reason,
    );
  }

  // Actualizar isActive en ScrapingSource
  await prisma.scrapingSource.update({
    where: { id: sourceId },
    data: { isActive: false },
  });

  log.info(`✅ Source ${sourceId} paused until ${pauseUntil.toISOString()}: ${reason}`);
  return { paused: true, pauseUntil, score: score.avgScore, reason };
}

/**
 * Despausa fuentes automáticamente si período ya expiró
 */
export async function unpausSourceIfExpired(sourceId: string, cityId?: string) {
  type PauseRecord = { paused_at: string | null; pause_duration_days: number };
  const pauseConfig = await prisma.$queryRawUnsafe<PauseRecord[]>(
    `
    SELECT paused_at, pause_duration_days
    FROM source_pause_config
    WHERE source_id = $1 AND city_id = $2
    `,
    sourceId,
    cityId || null,
  );

  if (!pauseConfig || pauseConfig.length === 0 || !pauseConfig[0].paused_at) {
    return { unpaused: false, reason: 'not_paused' };
  }

  const config = pauseConfig[0];
  if (!config.paused_at) {
    return { unpaused: false, reason: 'not_paused' };
  }
  const pausedAt = new Date(config.paused_at);
  const expireAt = new Date(pausedAt.getTime() + config.pause_duration_days * 24 * 60 * 60 * 1000);
  const now = new Date();

  if (now < expireAt) {
    return { unpaused: false, reason: 'pause_still_active', expireAt };
  }

  // Despausa
  if (cityId) {
    await prisma.$executeRawUnsafe(
      `
      UPDATE source_pause_config
      SET paused_at = NULL, paused_reason = NULL, updated_at = NOW()
      WHERE source_id = $1 AND city_id = $2
      `,
      sourceId,
      cityId,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `
      UPDATE source_pause_config
      SET paused_at = NULL, paused_reason = NULL, updated_at = NOW()
      WHERE source_id = $1 AND city_id IS NULL
      `,
      sourceId,
    );
  }

  // Reactivar en ScrapingSource (si no hay otros motivos de pausa)
  await prisma.scrapingSource.update({
    where: { id: sourceId },
    data: { isActive: true },
  });

  log.info(`✅ Source ${sourceId} unpaused after ${config.pause_duration_days} days`);
  return { unpaused: true, pausedFor: config.pause_duration_days, score: null };
}

/**
 * Obtener dashboard stats de todas las fuentes
 */
export async function getSourceDashboardStats(cityId?: string) {
  let query = `
    SELECT
      s.id,
      s.name,
      s.platform,
      c.name as city_name,
      c.id as city_id,
      sus.avg_url_score,
      sus.low_score_count,
      sus.high_score_count,
      sus.total_urls_processed,
      sus.last_scan_at,
      spc.paused_at,
      spc.paused_reason,
      spc.pause_threshold_score,
      spc.pause_duration_days,
      s.is_active
    FROM scraping_source s
    LEFT JOIN city c ON s.city_id = c.id
    LEFT JOIN source_url_stats sus ON s.id = sus.source_id AND (sus.city_id = c.id OR sus.city_id IS NULL)
    LEFT JOIN source_pause_config spc ON s.id = spc.source_id AND (spc.city_id = c.id OR spc.city_id IS NULL)
    WHERE 1=1
  `;

  type DashboardRow = Record<string, unknown>;
  const params: string[] = [];
  if (cityId) {
    query += ` AND c.id = $1`;
    params.push(cityId);
  }

  query += ` ORDER BY s.name`;

  const stats = await prisma.$queryRawUnsafe<DashboardRow[]>(query, ...params);
  return stats;
}
