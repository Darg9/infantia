// Convierte un texto a slug URL-safe
// Ej: "Bogotá D.C." → "bogota-dc"
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[^a-z0-9\s-]/g, '')   // solo alfanumérico
    .trim()
    .replace(/\s+/g, '-')           // espacios → guiones
    .replace(/-+/g, '-');           // guiones dobles → uno
}
