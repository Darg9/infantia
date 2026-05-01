// =============================================================================
// Error Handling Helper
// =============================================================================

/**
 * Extrae el mensaje de error de un objeto 'unknown'
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
