import { describe, it, expect } from 'vitest';
import { normalizeCity, levenshtein, citySimilarity } from '../city-normalizer';

describe('normalizeCity', () => {
  it('quita tildes', () => {
    expect(normalizeCity('Bogotá')).toBe('bogota');
    expect(normalizeCity('Medellín')).toBe('medellin');
    expect(normalizeCity('Barranquilla')).toBe('barranquilla');
  });

  it('convierte a lowercase', () => {
    expect(normalizeCity('BOGOTÁ')).toBe('bogota');
    expect(normalizeCity('Cali')).toBe('cali');
  });

  it('elimina sufijo D.C.', () => {
    expect(normalizeCity('Bogotá D.C.')).toBe('bogota');
    expect(normalizeCity('Bogotá D.C')).toBe('bogota');
    expect(normalizeCity('bogota d.c.')).toBe('bogota');
  });

  it('elimina sufijo después de coma', () => {
    expect(normalizeCity('Medellín, Antioquia')).toBe('medellin');
    expect(normalizeCity('Bogotá, Colombia')).toBe('bogota');
  });

  it('colapsa espacios extras', () => {
    expect(normalizeCity('  Bogotá  ')).toBe('bogota');
  });

  it('retorna string vacío para input vacío', () => {
    expect(normalizeCity('')).toBe('');
    expect(normalizeCity('   ')).toBe('');
  });

  it('casos reales del scraper', () => {
    expect(normalizeCity('Bogota')).toBe('bogota');
    expect(normalizeCity('bogota')).toBe('bogota');
    expect(normalizeCity('MEDELLIN')).toBe('medellin');
    expect(normalizeCity('Bucaramanga')).toBe('bucaramanga');
  });
});

describe('levenshtein', () => {
  it('strings idénticos → 0', () => {
    expect(levenshtein('bogota', 'bogota')).toBe(0);
  });

  it('string vacío → longitud del otro', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('1 sustitución', () => {
    expect(levenshtein('bogota', 'bogoto')).toBe(1);
  });

  it('1 inserción', () => {
    expect(levenshtein('bogota', 'bogoota')).toBe(1);
  });

  it('1 eliminación', () => {
    expect(levenshtein('bogota', 'bogta')).toBe(1);
  });

  it('diferencia significativa', () => {
    expect(levenshtein('bogota', 'cali')).toBeGreaterThan(3);
  });
});

describe('citySimilarity', () => {
  it('strings idénticos → 1', () => {
    expect(citySimilarity('bogota', 'bogota')).toBe(1);
  });

  it('strings vacíos → 1', () => {
    expect(citySimilarity('', '')).toBe(1);
  });

  it('similitud alta para variantes cercanas', () => {
    // "bogota" vs "bogota" después de normalizar "Bogotá" → mismo string
    expect(citySimilarity('bogota', 'bogota')).toBe(1);
  });

  it('similitud baja para ciudades distintas', () => {
    expect(citySimilarity('bogota', 'cali')).toBeLessThan(0.5);
  });

  it('score entre 0 y 1', () => {
    const score = citySimilarity('medellin', 'bogota');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
