import { describe, it, expect } from 'vitest';
import { getCategoryEmoji, getCategoryColor, getCategoryGradient, getCategoryShortLabel, CATEGORY_COLORS } from '../category-utils';

describe('getCategoryEmoji', () => {
  it('devuelve emoji correcto para categorías exactas', () => {
    expect(getCategoryEmoji('Arte y Creatividad')).toBe('🎨');
    expect(getCategoryEmoji('Música')).toBe('🎵');
    expect(getCategoryEmoji('Deportes')).toBe('⚽');
    expect(getCategoryEmoji('Teatro')).toBe('🎭');
    expect(getCategoryEmoji('Danza')).toBe('💃');
    expect(getCategoryEmoji('Lectura')).toBe('📚');
    expect(getCategoryEmoji('Tecnología')).toBe('💻');
    expect(getCategoryEmoji('Ciencias')).toBe('🔬');
    expect(getCategoryEmoji('Naturaleza')).toBe('🌿');
  });

  it('hace matching parcial (substring)', () => {
    expect(getCategoryEmoji('Piano Clásico')).toBe('🎹');
    expect(getCategoryEmoji('Ballet Clásico')).toBe('🩰');
    expect(getCategoryEmoji('Programación para Niños')).toBe('💻');
    expect(getCategoryEmoji('Inglés Básico')).toBe('🌍');
    expect(getCategoryEmoji('Fútbol Infantil')).toBe('⚽');
    expect(getCategoryEmoji('Experimentos de Ciencia')).toBe('🔬');
    expect(getCategoryEmoji('Pintura y Dibujo')).toBe('🖌️');
  });

  it('es case-insensitive', () => {
    expect(getCategoryEmoji('MÚSICA')).toBe('🎵');
    expect(getCategoryEmoji('teatro')).toBe('🎭');
    expect(getCategoryEmoji('Cocina')).toBe('👨‍🍳');
  });

  it('devuelve ✨ para categorías sin match', () => {
    expect(getCategoryEmoji('Otra Categoría')).toBe('✨');
    expect(getCategoryEmoji('')).toBe('✨');
    expect(getCategoryEmoji('Sin clasificar')).toBe('✨');
  });
});

describe('getCategoryGradient', () => {
  it('devuelve gradiente específico para slug canónico conocido', () => {
    const g = getCategoryGradient('musica');
    expect(g).toContain('linear-gradient');
    expect(g).toContain('a855f7'); // violeta canónico Música
  });

  it('devuelve gradiente para slug con tilde (alias)', () => {
    const g = getCategoryGradient('música');
    expect(g).toContain('a855f7');
  });

  it('devuelve gradiente para teatro-y-danza (canónico S68)', () => {
    expect(getCategoryGradient('teatro-y-danza')).toContain('ec4899'); // fucsia
  });

  it('usa hash fallback para slug desconocido — siempre es un gradiente válido', () => {
    const g = getCategoryGradient('slug-inexistente-xyz');
    expect(g).toContain('linear-gradient');
  });

  it('es determinista — mismo slug siempre da mismo gradiente', () => {
    expect(getCategoryGradient('slug-raro-abc')).toBe(getCategoryGradient('slug-raro-abc'));
  });

  it('slug vacío devuelve un gradiente fallback (sin bucle de hash)', () => {
    const g = getCategoryGradient('');
    expect(g).toContain('linear-gradient');
  });
});

describe('getCategoryShortLabel', () => {
  it('devuelve etiqueta corta para slug canónico (lectura → Lectura)', () => {
    expect(getCategoryShortLabel('lectura', 'Lectura')).toBe('Lectura');
  });

  it('devuelve etiqueta corta para teatro-y-danza → Teatro', () => {
    expect(getCategoryShortLabel('teatro-y-danza', 'Teatro y Danza')).toBe('Teatro');
  });

  it('usa primera palabra del fallbackName cuando slug no está mapeado', () => {
    expect(getCategoryShortLabel('slug-nuevo', 'Natación Avanzada')).toBe('Natación');
  });

  it('trunca a 11 chars + … cuando la primera palabra supera 12 caracteres', () => {
    // "Interdisciplinario" = 18 chars → debe truncarse
    const result = getCategoryShortLabel('slug-largo', 'Interdisciplinario en las Artes');
    expect(result).toBe('Interdiscip…');
    expect(result.length).toBeLessThanOrEqual(13);
  });

  it('no trunca cuando la primera palabra tiene ≤12 caracteres', () => {
    expect(getCategoryShortLabel('slug-nuevo', 'Pintura Digital')).toBe('Pintura');
  });

  it('es case-insensitive para slug lookup', () => {
    // CATEGORY_SHORT_LABELS usa claves en minúscula — el input se normaliza
    expect(getCategoryShortLabel('LECTURA', 'Lectura')).toBe('Lectura');
  });
});

describe('getCategoryColor', () => {
  it('devuelve siempre una clase válida de CATEGORY_COLORS', () => {
    const slugs = ['arte', 'musica', 'deportes', 'teatro', 'ciencias', 'lectura', 'tecnologia', 'danza'];
    for (const slug of slugs) {
      const color = getCategoryColor(slug);
      expect(CATEGORY_COLORS).toContain(color);
    }
  });

  it('es determinista — mismo slug siempre da mismo color', () => {
    expect(getCategoryColor('arte')).toBe(getCategoryColor('arte'));
    expect(getCategoryColor('musica')).toBe(getCategoryColor('musica'));
  });

  it('slugs distintos pueden dar colores distintos', () => {
    const colors = ['arte', 'musica', 'deportes', 'teatro', 'ciencias', 'lectura', 'tecnologia', 'danza']
      .map(getCategoryColor);
    const unique = new Set(colors);
    expect(unique.size).toBeGreaterThan(1);
  });
});
