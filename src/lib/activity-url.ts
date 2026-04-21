// =============================================================================
// activity-url.ts — utilidades para construir y parsear URLs de actividades
//
// Formato canónico: /actividades/{uuid}-{slug-del-titulo}
//   Ejemplo: /actividades/550e8400-e29b-41d4-a716-446655440000-taller-de-arte
//
// El UUID (36 chars) siempre va primero; el slug es sufijo opcional.
// Esto permite lookup por UUID sin necesidad de columna slug en la BD.
// =============================================================================

/** Convierte un título en slug URL-friendly (sin acentos, sin caracteres especiales) */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar diacríticos
    .replace(/[^a-z0-9\s-]/g, '')   // solo alfanumérico, espacios, guiones
    .trim()
    .replace(/\s+/g, '-')           // espacios → guiones
    .replace(/-+/g, '-')            // colapsar guiones múltiples
    .replace(/^-|-$/g, '')          // trim guiones al inicio/final
    .slice(0, 60);                   // máximo 60 chars
}

/** Construye la ruta canónica de una actividad */
export function activityPath(id: string, title: string): string {
  const slug = slugifyTitle(title)
  return `/actividades/${id}${slug ? `-${slug}` : ''}`
}

/**
 * Extrae el UUID del param de ruta, que puede ser:
 *   - "550e8400-e29b-41d4-a716-446655440000"          (formato legado)
 *   - "550e8400-e29b-41d4-a716-446655440000-taller"   (formato canónico)
 */
export function extractActivityId(param: string): string {
  const match = param.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  )
  return match ? match[0] : param
}
