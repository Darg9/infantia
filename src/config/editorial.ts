// =============================================================================
// editorial.ts — Configuración editorial y de curaduría
// Centraliza las reglas manuales de confianza, ranking y escasez visual.
// =============================================================================

/**
 * Fuentes Institucionales Verificadas.
 * 
 * Target: Máximo ~10–20% del feed visible.
 * El badge "Verificado" es una señal editorial escasa que transmite confianza
 * y curaduría. NO debe masificarse ni incluir automáticamente todo dominio gubernamental.
 */
export const VERIFIED_SOURCES = [
  'biblored.gov.co',
  'idartes.gov.co',
  'maloka.org',
  'planetariodebogota.gov.co'
];
