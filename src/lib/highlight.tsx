// =============================================================================
// highlight.tsx — Utilidad de resaltado para resultados de búsqueda
//
// Uso seguro: solo aplicar a contenido proveniente de nuestra propia DB.
// Devuelve ReactNode (no dangerouslySetInnerHTML) para compatibilidad total.
// =============================================================================

import React from 'react';

/**
 * Resalta todas las ocurrencias de `query` dentro de `text`.
 * Insensible a mayúsculas/minúsculas. Devuelve ReactNode.
 *
 * @example
 * highlightText("Taller de arte para niños", "arte")
 * // → "Taller de " <mark>arte</mark> " para niños"
 */
export function highlightText(text: string, query: string): React.ReactNode {
  if (!query || query.trim().length < 2) return text;

  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');

  const parts = text.split(regex);
  if (parts.length === 1) return text;

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="hp-highlight">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}
