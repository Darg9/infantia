// =============================================================================
// audience-utils.ts — Abstracción editorial para audiencias y edades
// =============================================================================

export type EditorialAudience = 'Bebés' | 'Niños' | 'Jóvenes' | 'Adultos' | 'Familia';

/**
 * Normaliza los rangos de edad técnicos y el enum de audiencia de BD
 * hacia una etiqueta editorial limpia y escaneable para la UI.
 */
export function getEditorialAudience(
  minAge: number | null | undefined, 
  maxAge: number | null | undefined, 
  audienceEnum: string | null | undefined
): EditorialAudience {
  // 1. Dinámica social familiar
  if (audienceEnum === 'FAMILY' || audienceEnum === 'ALL') {
    return 'Familia';
  }

  // 2. Por rango de edad prioritario (minAge es la señal más fuerte del target core)
  if (minAge != null) {
    if (minAge >= 18) return 'Adultos';
    if (minAge >= 13) return 'Jóvenes';
    if (minAge >= 3) return 'Niños';
    if (minAge <= 2) return 'Bebés';
  }

  // Fallback si no hay data suficiente
  return 'Familia';
}

/**
 * Retorna el emoji oficial asociado a cada etiqueta editorial
 */
export function getAudienceEmoji(label: EditorialAudience): string {
  switch (label) {
    case 'Bebés': return '👶';
    case 'Niños': return '👧';
    case 'Jóvenes': return '🛹';
    case 'Adultos': return '🧑';
    case 'Familia': return '👨‍👩‍👧';
    default: return '👨‍👩‍👧';
  }
}
