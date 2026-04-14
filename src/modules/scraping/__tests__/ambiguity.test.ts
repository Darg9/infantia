// =============================================================================
// Tests: modules/scraping/ambiguity.ts
// Pure function — no I/O, no mocks needed
// =============================================================================

import { describe, it, expect } from 'vitest';
import { ambiguityScore } from '../ambiguity';

describe('ambiguityScore', () => {
  it('devuelve 3 para texto vacío o falsy', () => {
    expect(ambiguityScore('')).toBe(3);
    expect(ambiguityScore(null as unknown as string)).toBe(3);
  });

  it('score 0 para texto largo y limpio', () => {
    const text = 'Este taller de música está diseñado para niños de todas las edades y ofrece una experiencia enriquecedora de aprendizaje.';
    expect(ambiguityScore(text)).toBe(0);
  });

  it('suma 1 por texto corto (< 60 chars)', () => {
    const text = 'Actividad de arte.';
    expect(ambiguityScore(text)).toBe(1);
  });

  it('suma 1 por presencia de # o @', () => {
    const text = 'Sigue nuestro perfil en @instagram para más información sobre los eventos y actividades infantiles.';
    expect(ambiguityScore(text)).toBe(1);
  });

  it('suma 1 por presencia de URL', () => {
    const text = 'Visita https://ejemplo.com para más información sobre este evento cultural de gran importancia.';
    expect(ambiguityScore(text)).toBe(1);
  });

  it('suma 1 por frase spam al inicio', () => {
    const text = 'Te invitamos a participar en este maravilloso evento cultural para toda la familia este fin de semana próximo.';
    expect(ambiguityScore(text)).toBe(1);
  });

  it('suma 1 por "no te pierdas" al inicio', () => {
    const text = 'No te pierdas este increíble taller de robótica para niños de 8 a 14 años que se llevará a cabo pronto.';
    expect(ambiguityScore(text)).toBe(1);
  });

  it('suma 1 por "ven" al inicio', () => {
    const text = 'Ven a disfrutar de este espectacular evento familiar que tenemos preparado para todos los asistentes.';
    expect(ambiguityScore(text)).toBe(1);
  });

  it('suma 1 por "descubre" al inicio', () => {
    const text = 'Descubre el fascinante mundo de la ciencia en nuestro nuevo laboratorio para niños y jóvenes estudiantes.';
    expect(ambiguityScore(text)).toBe(1);
  });

  it('acumula múltiples penalizaciones', () => {
    // corto (<60) + @ → score 2
    const text = 'Síguenos @cuenta para más info sobre el evento.';
    expect(ambiguityScore(text)).toBe(2);
  });

  it('score máximo 3 cuando se cumplen todas las condiciones', () => {
    // corto + @ + frase spam
    const text = 'Te invitamos @cuenta https://x.com';
    expect(ambiguityScore(text)).toBe(3);
  });
});
