// =============================================================================
// instrumentation.ts — Hook de inicialización de Next.js
// Carga Sentry server-side antes de que arranque la app.
// Solo activo cuando SENTRY_DSN está configurado.
// =============================================================================
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
}
