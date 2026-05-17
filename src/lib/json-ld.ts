// =============================================================================
// json-ld.ts — Serialización segura de JSON-LD para dangerouslySetInnerHTML
// =============================================================================
//
// PROBLEMA: JSON.stringify(data) con datos de BD puede contener </script> en
// campos de texto (ej. activity.title, activity.description). El HTML parser
// del navegador cierra el <script> en cuanto ve "</" seguido de "script>",
// independientemente de estar dentro de una cadena JSON. Resultado: XSS.
//
// SOLUCIÓN: escapar los caracteres problemáticos DESPUÉS del stringify.
// La barra "/" puede escaparse siempre como "\/" en JSON (RFC 8259 §7) —
// el navegador lo lee correctamente como "/" en el texto JSON.
//
// Escape aplicado:
//   </  →  <\/   (previene cierre prematuro de <script> o </style>)
//
// RFC 8259 §7: la barra "/" puede escaparse siempre como "\/" en JSON —
// el parser JSON lo resuelve al carácter original. El HTML parser, en cambio,
// nunca ve "</" y no puede cerrar el script tag prematuramente.
//
// Nota: "<!--" no se escapa aquí porque "\!" no es un escape JSON válido.
// La inyección de comentarios HTML es una amenaza menor y se mitiga con el
// CSP del sitio (next.config.ts).
//
// Uso:
//   <script type="application/ld+json"
//     dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} />
// =============================================================================

/**
 * Serializa `data` a JSON y escapa `</` para prevenir XSS en etiquetas
 * `<script type="application/ld+json">` cuando los datos provienen de la BD.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/<\//g, '<\\/')  // </  →  <\/  (evita </script>, </style>, etc.)
}
