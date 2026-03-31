// =============================================================================
// Sentry — configuración servidor (Node.js runtime)
// Solo activa si SENTRY_DSN está presente en las variables de entorno.
// =============================================================================
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,

  // Porcentaje de transacciones trazadas (performance monitoring)
  tracesSampleRate: 0.1,

  // Ocultar datos sensibles en breadcrumbs
  beforeBreadcrumb(breadcrumb) {
    // Omitir breadcrumbs de queries con contraseñas o tokens
    if (breadcrumb.category === 'http' && breadcrumb.data?.url?.includes('token')) {
      return null;
    }
    return breadcrumb;
  },
});
