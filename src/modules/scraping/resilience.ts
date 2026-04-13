import { createLogger } from '../../lib/logger';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

const log = createLogger('scraping:resilience');

/* ============================================================================
 * ERROR CLASSIFICATION
 * ============================================================================ */
export type NormalizedErrorType = 'timeout' | 'blocked' | 'parse_error' | 'empty_response' | 'unknown';

export function classifyError(error: any): NormalizedErrorType {
  const message = (error?.message || error?.toString() || '').toLowerCase();
  const status = error?.status || error?.response?.status;

  if (message.includes('timeout') || message.includes('abort') || message.includes('connreset')) {
    return 'timeout';
  }
  if (status === 403 || status === 429 || message.includes('forbidden') || message.includes('captcha') || message.includes('rate limit')) {
    return 'blocked';
  }
  if (message.includes('parse') || message.includes('json') || message.includes('syntax')) {
    return 'parse_error';
  }
  if (message.includes('empty') || message.includes('no extractable')) {
    return 'empty_response';
  }
  return 'unknown';
}

/* ============================================================================
 * RETRIES INTELIGENTES (BACKOFF)
 * ============================================================================ */
export interface FetchRetryResult {
  data: string;
  responseTime: number;
  methodUsed: string;
}

export async function fetchWithRetry(
  fetchFn: () => Promise<string>,
  methodName: string,
  maxRetries = 3
): Promise<FetchRetryResult> {
  let attempt = 1;
  const start = Date.now();

  while (attempt <= maxRetries) {
    try {
      const data = await fetchFn();
      
      if (!data || data.trim().length === 0) {
        throw new Error('empty_response');
      }

      return {
        data,
        responseTime: Date.now() - start,
        methodUsed: methodName,
      };
    } catch (error: any) {
      const errType = classifyError(error);
      const latency = Date.now() - start;

      log.info(JSON.stringify({
        event: 'scrape_retry',
        method: methodName,
        attempt,
        responseTime: latency,
        errorType: errType,
        message: error.message
      }));

      if (attempt === maxRetries || errType === 'blocked') {
        throw error; // Al quedarse sin reintentos o recibir un hard block
      }
      
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(res => setTimeout(res, delay));
      attempt++;
    }
  }

  throw new Error('Agotados reintentos');
}

/* ============================================================================
 * FALLBACKS POR FUENTE
 * ============================================================================ */
export type ScraperStrategyBuilder = () => Promise<string>;

export function getSourceStrategies(sourceType: string, extractors: any, url: string): ScraperStrategyBuilder[] {
  // Configurable based on known platform capabilities
  if (sourceType === 'WEBSITE') {
    return [
      () => extractors.cheerio().extract(url).then((res: any) => {
        if (res.status === 'FAILED' || (res.sourceText?.length ?? 0) < 50) throw new Error('Cheerio insuficient logic');
        return res.sourceText;
      }),
      () => extractors.playwright().extractWebText(url).then((res: any) => {
         if (res.status === 'FAILED') throw new Error(res.error || 'Playwright failed');
         return res.sourceText;
      })
    ];
  }
  
  if (sourceType === 'INSTAGRAM') {
    return [
      () => extractors.playwright().extractProfile(url, { maxPosts: 1 }).then((res: any) => JSON.stringify(res))
    ];
  }

  return [];
}

export async function fetchWithFallback(
  sourceUrl: string, 
  sourceType: string, 
  extractorsConfig: any
): Promise<FetchRetryResult> {
  const strategies = getSourceStrategies(sourceType, extractorsConfig, sourceUrl);

  for (let i = 0; i < strategies.length; i++) {
    const methodName = `Strategy_#${i+1}`;
    try {
      const result = await fetchWithRetry(strategies[i], methodName, 2);
      
      log.info(JSON.stringify({
        event: 'scrape_success',
        source: sourceType,
        url: sourceUrl,
        method: methodName,
        responseTime: result.responseTime,
        timestamp: new Date().toISOString()
      }));

      return result;
    } catch (error: any) {
      log.info(JSON.stringify({
        event: 'scrape_fallback',
        source: sourceType,
        url: sourceUrl,
        methodFailed: methodName,
        errorType: classifyError(error),
        timestamp: new Date().toISOString()
      }));
      
      // Si fue la última estrategia, el fallo es definitivo
      if (i === strategies.length - 1) {
        log.info(JSON.stringify({
          event: 'scrape_failed',
          source: sourceType,
          url: sourceUrl,
          reason: 'All strategies exhausted',
          timestamp: new Date().toISOString()
        }));
        throw error;
      }
    }
  }

  throw new Error('Sin estrategias validables');
}

/* ============================================================================
 * HEALTH SCORING
 * ============================================================================ */
export interface SourceHealthResult {
  success: boolean;
  responseTimeMs: number;
}

export async function updateSourceHealth(sourceHost: string, result: SourceHealthResult): Promise<void> {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString });
  const p = new PrismaClient({ adapter });

  try {
    const current = await p.sourceHealth.findUnique({ where: { source: sourceHost } });
    
    // Fallback if not tracked yet
    const base = current ?? {
      successCount: 0,
      errorCount: 0,
      avgResponseMs: 0,
    };

    const newSuccessCount = result.success ? base.successCount + 1 : base.successCount;
    const newErrorCount = result.success ? base.errorCount : base.errorCount + 1;
    const totalRequests = newSuccessCount + newErrorCount;

    // Media Móvil Simple
    const newAvgResponse = Math.floor(
      (base.avgResponseMs * (totalRequests - 1) + result.responseTimeMs) / totalRequests
    );

    // Scoring calculation (capped latency penalty prevents pure Playwright domains from failing natively)
    const successRate = newSuccessCount / totalRequests;
    const errorRate = newErrorCount / totalRequests;
    
    const MAX_LATENCY_MS = 3000;
    const latencyFactor = Math.min(newAvgResponse, MAX_LATENCY_MS) / MAX_LATENCY_MS;

    let newScore = (successRate * 0.6) - (errorRate * 0.3) - (latencyFactor * 0.1);
    if (newScore < 0) newScore = 0;
    if (newScore > 1) newScore = 1;

    // 1. Evitar "cold start bias" en score (no ser 1.0 artificialmente)
    if (totalRequests < 5) {
      newScore = 0.5; // neutral
    } 
    // 2. Evitar sobre-penalización por pocos errores
    else if (totalRequests < 10) {
      newScore = (newScore + 0.5) / 2; // suavizado progresivo
    }

    let newStatus = 'healthy';
    if (newScore > 0.7) newStatus = 'healthy';
    else if (newScore >= 0.4) newStatus = 'degraded';
    else newStatus = 'critical';

    if (newStatus !== current?.status && newStatus === 'critical') {
      log.info(JSON.stringify({
        event: 'source_critical_penalty',
        source: sourceHost,
        score: newScore,
        timestamp: new Date().toISOString()
      }));
    }

    await p.sourceHealth.upsert({
      where: { source: sourceHost },
      create: {
        source: sourceHost,
        successCount: newSuccessCount,
        errorCount: newErrorCount,
        lastSuccessAt: result.success ? new Date() : null,
        lastErrorAt: !result.success ? new Date() : null,
        avgResponseMs: newAvgResponse,
        score: newScore,
        status: newStatus,
      },
      update: {
        successCount: newSuccessCount,
        errorCount: newErrorCount,
        lastSuccessAt: result.success ? new Date() : undefined,
        lastErrorAt: !result.success ? new Date() : undefined,
        avgResponseMs: newAvgResponse,
        score: newScore,
        status: newStatus,
      }
    });

  } catch (err: any) {
    log.error(`Fallo escribiendo source health para ${sourceHost}: ${err.message}`);
  } finally {
    await p.$disconnect();
  }
}

export async function shouldSkipSource(sourceHost: string): Promise<{ skip: boolean; reason?: string }> {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString });
  const p = new PrismaClient({ adapter });

  try {
    const health = await p.sourceHealth.findUnique({ where: { source: sourceHost } });
    if (!health) return { skip: false };

    if (health.status === 'critical') {
      const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
      if (health.lastErrorAt && Date.now() - health.lastErrorAt.getTime() < SIX_HOURS_MS) {
        log.info(JSON.stringify({ 
          event: "source_blocked", 
          source: sourceHost, 
          message: "Bloqueo por penalización Crítica en enfriamiento (6h)" 
        }));
        return { skip: true, reason: 'CRITICAL_COOLDOWN' };
      } else {
        log.info(JSON.stringify({ 
          event: "source_auto_recovery", 
          source: sourceHost, 
          message: "Período de enfriamiento superado. Intentando recovery." 
        }));
        return { skip: false };
      }
    }
    
    return { skip: false };
  } finally {
    await p.$disconnect();
  }
}
