// =============================================================================
// site.ts — Fuente única de verdad para la URL del sitio
//
// Prioridad:
// 1. NEXT_PUBLIC_SITE_URL          → Override manual (dominio custom, ej: infantia.app)
// 2. NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL → Inyectado automáticamente por Vercel
// 3. Fallback hardcodeado          → Solo si ninguna variable está disponible
//
// Para cambiar de dominio: solo actualizar NEXT_PUBLIC_SITE_URL en Vercel.
// Vercel también actualiza NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL automáticamente.
// =============================================================================

const vercelProductionUrl = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (vercelProductionUrl ? `https://${vercelProductionUrl}` : 'https://infantia-activities.vercel.app');
