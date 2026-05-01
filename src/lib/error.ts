// =============================================================================
// Error Handling Helper
// =============================================================================

/**
 * Extrae el mensaje de error de cualquier valor `unknown`:
 * - Instancias de Error → err.message
 * - Objetos con campo message (ej. respuestas de APIs externas) → err.message
 * - Cualquier otro valor → String(err)
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message?: unknown }).message);
  }
  return String(err);
}
