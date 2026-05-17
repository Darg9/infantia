// =============================================================================
// instrumentation-client.ts — Hook de inicialización cliente (browser)
// Requerido por Next.js 15 + @sentry/nextjs v10 para capturar errores frontend.
//
// dynamic import nombrado: tree-shakeable (vs namespace import que bundlea todo).
// =============================================================================
import '../sentry.client.config';

export const onRouterTransitionStart = (await import('@sentry/nextjs')).captureRouterTransitionStart;
