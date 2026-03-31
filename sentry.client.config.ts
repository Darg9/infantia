// =============================================================================
// Sentry — configuración cliente (browser)
// Solo activa si NEXT_PUBLIC_SENTRY_DSN está presente.
// =============================================================================
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Muestra el feedback dialog cuando hay un crash en el cliente
  tracesSampleRate: 0.05,

  // No loguear errores en desarrollo (muy verboso)
  debug: false,
});
