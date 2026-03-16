import { describe, it, expect } from 'vitest';
import { getCategoryEmoji, getCategoryColor, CATEGORY_COLORS } from '../category-utils';

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
    expect(getCategoryEmoji('Cocina Para Niños')).toBe('👨‍🍳');
  });

  it('devuelve ✨ para categorías sin match', () => {
    expect(getCategoryEmoji('Otra Categoría')).toBe('✨');
    expect(getCategoryEmoji('')).toBe('✨');
    expect(getCategoryEmoji('Sin clasificar')).toBe('✨');
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
