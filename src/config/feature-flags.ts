// =============================================================================
// feature-flags.ts — Control de activación de features experimentales
//
// Uso:
//   import { FEATURE_FLAGS } from '@/config/feature-flags'
//   if (FEATURE_FLAGS.PARSER_FALLBACK_ENABLED) { ... }
//
// Override por entorno (.env):
//   PARSER_FALLBACK=true   → activa fallback
//   PARSER_FALLBACK=false  → modo legacy (solo Gemini, comportamiento pre-S52)
//
// Rollback instantáneo sin redeploy: cambiar la var en Vercel env vars.
// =============================================================================

export const FEATURE_FLAGS = {
  /**
   * Parser resiliente (S52):
   * - Fase 2: discoverWithFallback — pasa todos los URLs si Gemini lanza 429/503
   * - Fase 3: parseActivity — usa fallbackFromCheerio si Gemini lanza 429/503
   *
   * ON  → resiliencia activa (Gemini + fallback Cheerio)
   * OFF → modo legacy (solo Gemini, comportamiento pre-S52)
   *
   * Default: true (activo en producción)
   */
  PARSER_FALLBACK_ENABLED: process.env.PARSER_FALLBACK !== 'false',
} as const;
