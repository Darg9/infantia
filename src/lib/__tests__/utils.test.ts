// =============================================================================
// Tests: lib/utils.ts
// =============================================================================

import { describe, it, expect } from 'vitest';
import { cn, formatPrice, calculateAge, slugify } from '../utils';

describe('cn()', () => {
  it('une clases simples', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('ignora valores falsy', () => {
    expect(cn('foo', undefined, null, false, 'bar')).toBe('foo bar');
  });

  it('retorna string vacío sin argumentos', () => {
    expect(cn()).toBe('');
  });

  it('acepta un solo argumento', () => {
    expect(cn('solo')).toBe('solo');
  });
});

describe('formatPrice()', () => {
  it('formatea precio en COP por defecto', { timeout: 15000 }, () => {
    const result = formatPrice(50000);
    expect(result).toContain('50');
    expect(result).toContain('000');
  });

  it('formatea precio 0 correctamente', () => {
    const result = formatPrice(0);
    expect(result).toContain('0');
  });

  it('formatea precio en USD cuando se indica', () => {
    const result = formatPrice(100, 'USD');
    expect(result).toContain('100');
  });

  it('formatea precios grandes', () => {
    const result = formatPrice(1000000);
    expect(result).toContain('1');
  });
});

describe('calculateAge()', () => {
  it('calcula edad correctamente para alguien nacido hace exactamente 10 años', () => {
    const today = new Date();
    const birthDate = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
    expect(calculateAge(birthDate)).toBe(10);
  });

  it('resta 1 año si el cumpleaños es mañana', () => {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate() + 1);
    expect(calculateAge(tomorrow)).toBe(9);
  });

  it('retorna 0 para un bebé recién nacido', () => {
    const today = new Date();
    expect(calculateAge(today)).toBe(0);
  });

  it('calcula correctamente edad de 5 años', () => {
    const today = new Date();
    const birthDate = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
    expect(calculateAge(birthDate)).toBe(5);
  });
});

describe('slugify()', () => {
  it('convierte texto a minúsculas', () => {
    expect(slugify('NATACIÓN')).toBe('natacion');
  });

  it('elimina acentos', () => {
    expect(slugify('activación')).toBe('activacion');
  });

  it('reemplaza espacios con guiones', () => {
    expect(slugify('taller de arte')).toBe('taller-de-arte');
  });

  it('elimina guiones al inicio y final', () => {
    expect(slugify(' texto ')).toBe('texto');
  });

  it('maneja múltiples espacios consecutivos', () => {
    expect(slugify('hola   mundo')).toBe('hola-mundo');
  });

  it('elimina caracteres especiales', () => {
    expect(slugify('¡Hola! ¿Cómo estás?')).toBe('hola-como-estas');
  });

  it('maneja texto ya en formato slug', () => {
    expect(slugify('ya-es-slug')).toBe('ya-es-slug');
  });

  it('maneja nombre típico de actividad infantia', () => {
    expect(slugify('Jardín Botánico — Taller Niños')).toBe('jardin-botanico-taller-ninos');
  });
});
