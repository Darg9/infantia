// =============================================================================
// Tests: lib/search.ts
// Pure function — no I/O, no mocks needed
// =============================================================================

import { describe, it, expect } from 'vitest';
import { normalizeSearchQuery } from '../search';

describe('normalizeSearchQuery', () => {
  it('retorna string vacío para query vacío', () => {
    expect(normalizeSearchQuery('')).toBe('');
    expect(normalizeSearchQuery(null as unknown as string)).toBe('');
  });

  it('convierte a minúsculas', () => {
    expect(normalizeSearchQuery('ARTE')).toBe('arte');
  });

  it('elimina puntuación conflictiva', () => {
    expect(normalizeSearchQuery('arte, música!')).toBe('arte musica');
  });

  it('elimina stopwords conocidas y normaliza NFD', () => {
    expect(normalizeSearchQuery('el taller de arte')).toBe('taller arte');
    expect(normalizeSearchQuery('los niños y las niñas')).toBe('ninos ninas');
  });

  it('normaliza caracteres con tildes y diacríticos (NFD)', () => {
    expect(normalizeSearchQuery('Bogotá Medellín canción pingüino')).toBe('bogota medellin cancion pinguino');
  });

  it('conserva números en los tokens', () => {
    expect(normalizeSearchQuery('taller para niños de 8 años')).toContain('8');
  });

  it('colapsa espacios múltiples', () => {
    const result = normalizeSearchQuery('taller   de   arte');
    expect(result).not.toMatch(/\s{2,}/);
  });

  it('revierte al raw si todos los tokens son stopwords', () => {
    // "el y de" → todos stopwords → fallback al raw normalizado
    const result = normalizeSearchQuery('el y de');
    expect(result).toBe('el y de');
  });

  it('preserva palabras de menos de 3 chars que no son stopwords', () => {
    // 'ai', 'ar' no son stopwords — deben conservarse
    const result = normalizeSearchQuery('curso ar');
    expect(result).toContain('ar');
  });

  it('maneja query con solo espacios', () => {
    const result = normalizeSearchQuery('   ');
    // raw.trim() → '' → tokens = [''] → filtered sin stopwords = [''] → filtered.join = ''
    expect(typeof result).toBe('string');
  });
});
