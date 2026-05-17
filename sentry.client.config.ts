// =============================================================================
// Sentry — configuración cliente (browser)
// Solo activa si NEXT_PUBLIC_SENTRY_DSN está presente.
//
// IMPORTANTE: import nombrado (no `import * as Sentry`) — permite tree-shaking.
// `import * as` bundlea Feedback, Replay, Profiling, LangChain (~380KB gz)
// aunque no estén configurados. Named import elimina ese overhead.
// =============================================================================
import { init } from '@sentry/nextjs';

init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Muestra el feedback dialog cuando hay un crash en el cliente
  tracesSampleRate: 0.05,

  // No loguear errores en desarrollo (muy verboso)
  debug: false,
});
