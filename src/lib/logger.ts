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

function formatLine(level: Level, message: string, meta?: LogMeta): string {
  const ts  = new Date().toISOString();
  const ctx = meta?.ctx ? `[${meta.ctx}] ` : '';
  // Extra data: todo menos ctx y error (que se loguea por separado)
  const { ctx: _ctx, error: _err, ...rest } = meta ?? {};
  const extras = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
  return `${ts} ${PREFIXES[level]} ${ctx}${message}${extras}`;
}

function write(level: Level, message: string, meta?: LogMeta): void {
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
