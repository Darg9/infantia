// =============================================================================
// logger.ts — Logger estructurado universal
//
// Emite líneas con timestamp + nivel + contexto, capturadas por Vercel Logs.
// En producción: errors se reportan a Sentry si SENTRY_DSN está configurado.
// Compatible con API routes (server) y workers (Node.js process).
// =============================================================================

type Level = 'debug' | 'info' | 'warn' | 'error';

export interface LogMeta {
  ctx?: string;
  error?: unknown;
  [key: string]: unknown;
}

const PREFIXES: Record<Level, string> = {
  debug: 'DEBUG',
  info:  'INFO ',
  warn:  'WARN ',
  error: 'ERROR',
};

// ─── Browser Deduplication (UI Throttle) ──────────────────────────────────────
const recentLogs = new Map<string, number>();
const THROTTLE_MS = 2000;

function isDuplicateBrowserLog(key: string): boolean {
  if (typeof window === 'undefined') return false; // Only deduplicate on client
  const now = Date.now();
  const last = recentLogs.get(key);
  if (last && now - last < THROTTLE_MS) return true;
  
  recentLogs.set(key, now);
  if (recentLogs.size > 200) {
    const threshold = now - THROTTLE_MS;
    for (const [k, v] of recentLogs.entries()) {
      if (v < threshold) recentLogs.delete(k);
    }
  }
  return false;
}

function formatLine(level: Level, message: string, meta?: LogMeta): string {
  const ts  = new Date().toISOString();
  const ctx = meta?.ctx ? `[${meta.ctx}] ` : '';
  // Guard: si meta no es un objeto plano (e.g. se pasó un string o un Error directamente)
  // lo ignoramos para no serializar como array de caracteres {"0":"x","1":"y"...}
  const safeMeta = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
  // Extra data: todo menos ctx y error (que se loguea por separado)
  const { ctx: _ctx, error: _err, ...rest } = safeMeta;
  const extras = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
  return `${ts} ${PREFIXES[level]} ${ctx}${message}${extras}`;
}

function write(level: Level, message: string, meta?: LogMeta): void {
  // 1. Deduplicación en Client-Side (React Strict Mode / Re-renders shielding)
  if (typeof window !== 'undefined') {
    const action = meta?.action ? String(meta.action) : '';
    const result = meta?.result ? String(meta.result) : '';
    const ctxStr = meta?.ctx ? String(meta.ctx) : '';
    const dedupKey = `${level}:${ctxStr}:${message}:${action}:${result}`;
    if (isDuplicateBrowserLog(dedupKey)) return;

    // Producción Frontend limpia: inhibimos logs para no ensuciar consola (salvo hooks de analytics)
    if (process.env.NODE_ENV === 'production') {
      // trackAnalytics(level, message, meta) // Opcional integración
      return; 
    }
  }

  const line = formatLine(level, message, meta);

  if (level === 'error') {
    console.error(line, meta?.error ?? '');
    // Captura asíncrona a Sentry — no bloquea el request
    if (typeof process !== 'undefined' && process.env.SENTRY_DSN && meta?.error) {
      import('@sentry/nextjs')
        .then(({ captureException }) =>
          captureException(meta.error, { extra: { message, ...meta } }),
        )
        .catch(() => { /* fail silently */ });
    }
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

export const logger = {
  debug: (message: string, meta?: LogMeta) => write('debug', message, meta),
  info:  (message: string, meta?: LogMeta) => write('info',  message, meta),
  warn:  (message: string, meta?: LogMeta) => write('warn',  message, meta),
  error: (message: string, meta?: LogMeta) => write('error', message, meta),
};

/**
 * Crea un logger con contexto fijo — evita repetir ctx en cada llamada.
 *
 * @example
 *   const log = createLogger('email');
 *   log.info('Welcome enviado', { to: 'user@example.com' });
 *   // → 2026-03-31T12:00:00Z INFO  [email] Welcome enviado {"to":"user@example.com"}
 */
export function createLogger(ctx: string) {
  return {
    debug: (message: string, meta?: Omit<LogMeta, 'ctx'>) =>
      write('debug', message, { ...meta, ctx }),
    info:  (message: string, meta?: Omit<LogMeta, 'ctx'>) =>
      write('info',  message, { ...meta, ctx }),
    warn:  (message: string, meta?: Omit<LogMeta, 'ctx'>) =>
      write('warn',  message, { ...meta, ctx }),
    error: (message: string, meta?: Omit<LogMeta, 'ctx'>) =>
      write('error', message, { ...meta, ctx }),
  };
}

export type AppLogger = ReturnType<typeof createLogger>;
