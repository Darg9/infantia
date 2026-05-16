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

  /**
   * Discovery Ranking (S53):
   * Capa de optimización pre-Gemini para filtrar URLs basura.
   * - ENABLED: Activa la evaluación del ranking.
   * - MODE: 'shadow' (calcula pero usa baseline), 'hard' (aplica el ranking).
   * - MODE_BY_SOURCE: override por dominio hostname (sin www).
   *   Formato JSON en env: '{"culturarecreacionydeporte.gov.co":"hard"}'
   *   Default en código: SCRD en hard (alta diferencia shadow vs baseline).
   */
  DISCOVERY_RANKING_ENABLED: process.env.DISCOVERY_RANKING_ENABLED !== 'false', // Default: true
  DISCOVERY_RANKING_MODE: (process.env.DISCOVERY_RANKING_MODE === 'hard' ? 'hard' : 'shadow') as 'hard' | 'shadow',
  DISCOVERY_RANKING_MODE_BY_SOURCE: (() => {
    const defaults: Record<string, 'hard' | 'shadow'> = {
      'culturarecreacionydeporte.gov.co': 'hard',
      'biblored.gov.co':                  'hard',
      'idartes.gov.co':                   'hard',
      'planetariodebogota.gov.co':        'hard',
      'bogota.gov.co':                    'hard',
    };
    const raw = process.env.DISCOVERY_RANKING_MODE_BY_SOURCE;
    if (!raw) return defaults;
    try { return JSON.parse(raw) as Record<string, 'hard' | 'shadow'>; } catch { return defaults; }
  })(),

  /**
   * Filtro de fecha (S65):
   * Chips "Hoy", "Este finde", "Esta semana" en /actividades.
   *
   * OFF por defecto — startDate incompleto en catálogo (~60% actividades sin fecha).
   * Activar en Vercel: DATE_FILTER_ENABLED=true (no requiere redeploy).
   *
   * Filtro es estricto: solo muestra actividades con startDate en el rango.
   * Cuando se active, se recomienda priorizar ingest de fuentes con fecha.
   */
  DATE_FILTER_ENABLED: process.env.DATE_FILTER_ENABLED === 'true',

  /**
   * Badge de audiencia en ActivityCard (S71):
   * Muestra "👨‍👩‍👧 Familia", "👧 Niños", "🧑 Adultos", etc. en el footer.
   *
   * OFF por defecto — ageMin/ageMax/audience incompletos en catálogo:
   * la mayoría cae en el fallback 'Familia' sin ser información verificada.
   * Reactivar cuando el pipeline extraiga y valide edades de forma consistente.
   *
   * Activar en Vercel: SHOW_AUDIENCE_LABEL=true (sin redeploy).
   */
  SHOW_AUDIENCE_LABEL: process.env.SHOW_AUDIENCE_LABEL === 'true',

  /**
   * Filtro de edad en /actividades (S72):
   * Selector "Edad" (0–3, 4–6, 7–10, +10) en desktop y mobile.
   *
   * OFF por defecto — ageMin/ageMax incompletos en catálogo: la mayoría de
   * actividades no tienen edad extraída de forma fiable. El filtro devuelve
   * resultados escasos y confunde al usuario.
   * Reactivar cuando el pipeline extraiga y valide edades consistentemente.
   *
   * Activar en Vercel: AGE_FILTER_ENABLED=true (sin redeploy).
   */
  AGE_FILTER_ENABLED: process.env.AGE_FILTER_ENABLED === 'true',
} as const;
