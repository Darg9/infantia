/// <reference types="vitest/globals" />
import { normalizeQuery, STOP_WORDS } from '../search-normalizer';

describe('Search Normalizer', () => {
  it('should remove diacritics and convert to lowercase', () => {
    expect(normalizeQuery('Niños')).toBe('ninos');
    expect(normalizeQuery('VACACIÓN')).toBe('vacacion');
    expect(normalizeQuery('Canción De Cuna')).toBe('cancion cuna'); // "de" es eliminada
  });

  it('should remove stop words', () => {
    const q = 'actividades gratis para los niños en bogota';
    const result = normalizeQuery(q);
    // stop words: para, los, en
    // "bogota" len=6, "actividades" len=11, "gratis" len=6, "ninos" len=5
    // Todos son > 3 y no son stop words
    expect(result).toBe('actividades gratis ninos'); // máximo 3 tokens
  });

  it('should filter out short words (<= 3 chars) unless they are not stop words and we need them?', () => {
    // The current logic filters EVERYTHING <= 3
    const result = normalizeQuery('ver pez en el rio');
    // "ver" = 3 (filtered), "pez" = 3 (filtered), "en" = stop, "el" = stop, "rio" = 3 (filtered)
    expect(result).toBe('');
  });

  it('should return empty string for empty input', () => {
    expect(normalizeQuery('')).toBe('');
    expect(normalizeQuery('   ')).toBe('');
  });

  it('should slice to max 3 strong tokens', () => {
    const q = 'taller pintura acuarela infantil fin semana bogota';
    const result = normalizeQuery(q);
    expect(result).toBe('taller pintura acuarela'); // toma los 3 primeros válidos
  });

  it('should not pad to 3 if there are fewer tokens', () => {
    const q = 'robotica infantil';
    const result = normalizeQuery(q);
    expect(result).toBe('robotica infantil');
  });

  it('should correctly handle the STOP_WORDS set', () => {
    expect(STOP_WORDS.has('para')).toBe(true);
    expect(STOP_WORDS.has('de')).toBe(true);
  });
});
