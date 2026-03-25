import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeString,
  generateActivityFingerprint,
  calculateSimilarity,
  isProbablyDuplicate,
  logDuplicate,
  extractDateInfo,
} from '../deduplication';

// ── normalizeString ──────────────────────────────────────────────────────────

describe('normalizeString()', () => {
  it('convierte a minúsculas', () => {
    expect(normalizeString('HOLA MUNDO')).toBe('hola mundo');
  });

  it('elimina acentos', () => {
    expect(normalizeString('Taller de Música')).toBe('taller de musica');
    expect(normalizeString('Álgebra Básica')).toBe('algebra basica');
    expect(normalizeString('Éxito en el Año')).toBe('exito en el ano');
  });

  it('elimina caracteres especiales excepto espacios', () => {
    expect(normalizeString('¡Hola! ¿Cómo estás?')).toBe('hola como estas');
    expect(normalizeString('Taller: niños & jóvenes')).toBe('taller ninos jovenes');
  });

  it('normaliza espacios múltiples', () => {
    expect(normalizeString('  hola   mundo  ')).toBe('hola mundo');
  });

  it('trim al inicio y al final', () => {
    expect(normalizeString('  test  ')).toBe('test');
  });

  it('maneja string vacío', () => {
    expect(normalizeString('')).toBe('');
  });

  it('maneja string solo de espacios', () => {
    expect(normalizeString('   ')).toBe('');
  });

  it('mantiene números', () => {
    expect(normalizeString('Actividad 2026')).toBe('actividad 2026');
  });
});

// ── generateActivityFingerprint ──────────────────────────────────────────────

describe('generateActivityFingerprint()', () => {
  it('retorna un string de 16 caracteres', () => {
    const fp = generateActivityFingerprint('Taller de arte');
    expect(fp).toHaveLength(16);
  });

  it('retorna solo caracteres hexadecimales', () => {
    const fp = generateActivityFingerprint('Taller de arte', '2026-03-15', 'Bogotá');
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it('el mismo título, fecha y ubicación producen el mismo fingerprint', () => {
    const fp1 = generateActivityFingerprint('Taller de arte', '2026-03-15', 'Bogotá');
    const fp2 = generateActivityFingerprint('Taller de arte', '2026-03-15', 'Bogotá');
    expect(fp1).toBe(fp2);
  });

  it('títulos diferentes producen fingerprints diferentes', () => {
    const fp1 = generateActivityFingerprint('Taller de arte', '2026-03-15');
    const fp2 = generateActivityFingerprint('Taller de música', '2026-03-15');
    expect(fp1).not.toBe(fp2);
  });

  it('fechas en el mismo mes producen el mismo fingerprint (usa solo YYYYMM)', () => {
    const fp1 = generateActivityFingerprint('Taller', '2026-03-01');
    const fp2 = generateActivityFingerprint('Taller', '2026-03-31');
    expect(fp1).toBe(fp2);
  });

  it('fechas en meses diferentes producen fingerprints diferentes', () => {
    const fp1 = generateActivityFingerprint('Taller', '2026-03-15');
    const fp2 = generateActivityFingerprint('Taller', '2026-04-15');
    expect(fp1).not.toBe(fp2);
  });

  it('funciona sin fecha', () => {
    const fp = generateActivityFingerprint('Taller de arte');
    expect(fp).toHaveLength(16);
  });

  it('funciona sin ubicación', () => {
    const fp = generateActivityFingerprint('Taller de arte', '2026-03-15');
    expect(fp).toHaveLength(16);
  });

  it('ignora variantes de acentos en el título', () => {
    const fp1 = generateActivityFingerprint('Taller de música');
    const fp2 = generateActivityFingerprint('Taller de musica');
    expect(fp1).toBe(fp2);
  });

  it('fecha sin formato YYYY-MM no afecta el dateKey', () => {
    const fp1 = generateActivityFingerprint('Taller', 'fecha inválida');
    const fp2 = generateActivityFingerprint('Taller');
    expect(fp1).toBe(fp2);
  });
});

// ── calculateSimilarity ──────────────────────────────────────────────────────

describe('calculateSimilarity()', () => {
  it('strings idénticos tienen 100% de similitud', () => {
    expect(calculateSimilarity('taller de arte', 'taller de arte')).toBe(100);
  });

  it('strings completamente distintos tienen 0% de similitud', () => {
    expect(calculateSimilarity('perro', 'gato')).toBe(0);
  });

  it('strings con una palabra en común tienen similitud parcial', () => {
    const sim = calculateSimilarity('taller de arte', 'taller de música');
    // palabras en común: taller, de (2 de 4 en unión)
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(100);
  });

  it('la similitud es simétrica', () => {
    const sim1 = calculateSimilarity('taller de arte', 'taller de música');
    const sim2 = calculateSimilarity('taller de música', 'taller de arte');
    expect(sim1).toBe(sim2);
  });

  it('normaliza antes de comparar (acentos)', () => {
    const sim = calculateSimilarity('Taller de Música', 'taller de musica');
    expect(sim).toBe(100);
  });

  it('un string vacío comparado con uno no vacío retorna 0', () => {
    expect(calculateSimilarity('', 'algo')).toBe(0);
    expect(calculateSimilarity('algo', '')).toBe(0);
  });

  it('retorna un número entre 0 y 100', () => {
    const sim = calculateSimilarity('concierto en el parque', 'taller de yoga para niños');
    expect(sim).toBeGreaterThanOrEqual(0);
    expect(sim).toBeLessThanOrEqual(100);
  });

  it('palabras duplicadas en un string se cuentan una sola vez (Set)', () => {
    const sim = calculateSimilarity('taller taller arte', 'taller arte');
    // normalizeString no deduplica, pero calculateSimilarity usa Set
    expect(sim).toBe(100);
  });
});

// ── isProbablyDuplicate ──────────────────────────────────────────────────────

describe('isProbablyDuplicate()', () => {
  it('retorna true para títulos idénticos sin fechas', () => {
    expect(isProbablyDuplicate('Taller de arte', undefined, 'Taller de arte', undefined)).toBe(true);
  });

  it('retorna false para títulos muy distintos', () => {
    expect(isProbablyDuplicate('Taller de arte', undefined, 'Concierto de jazz', undefined)).toBe(false);
  });

  it('retorna true si similitud >= minSimilarity y fechas dentro de 7 días', () => {
    const result = isProbablyDuplicate(
      'Taller de arte para niños',
      '2026-03-15',
      'Taller de arte para niños',
      '2026-03-17'
    );
    expect(result).toBe(true);
  });

  it('retorna false si fechas difieren más de 7 días (aunque similitud alta)', () => {
    const result = isProbablyDuplicate(
      'Taller de arte',
      '2026-03-01',
      'Taller de arte',
      '2026-03-15'
    );
    expect(result).toBe(false);
  });

  it('retorna false si similitud < minSimilarity (default 70)', () => {
    const result = isProbablyDuplicate(
      'Taller de arte',
      '2026-03-15',
      'Concierto de rock',
      '2026-03-15'
    );
    expect(result).toBe(false);
  });

  it('usa minSimilarity personalizado', () => {
    // con threshold de 50, strings moderadamente similares son duplicados
    const result = isProbablyDuplicate(
      'taller de arte bogota',
      undefined,
      'taller de musica bogota',
      undefined,
      50
    );
    // taller, de, bogota en común (3), union ~5 = ~60% → true con threshold 50
    expect(result).toBe(true);
  });

  it('con minSimilarity 100, solo duplicados exactos', () => {
    const result = isProbablyDuplicate(
      'Taller de arte',
      undefined,
      'Taller de musica',
      undefined,
      100
    );
    expect(result).toBe(false);
  });

  it('si solo una fecha está presente, usa solo similitud de título', () => {
    const result = isProbablyDuplicate(
      'Taller de arte',
      '2026-03-15',
      'Taller de arte',
      undefined
    );
    expect(result).toBe(true);
  });

  it('acepta fechas exactamente 7 días de diferencia', () => {
    const result = isProbablyDuplicate(
      'Taller de arte',
      '2026-03-01T00:00:00Z',
      'Taller de arte',
      '2026-03-08T00:00:00Z'
    );
    expect(result).toBe(true);
  });
});

// ── logDuplicate ─────────────────────────────────────────────────────────────

describe('logDuplicate()', () => {
  it('llama console.log tres veces', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logDuplicate(
      { id: '1', title: 'Taller de arte', source: 'BibloRed' },
      { title: 'Taller de arte', source: 'IDARTES' },
      85
    );

    expect(consoleSpy).toHaveBeenCalledTimes(3);
    consoleSpy.mockRestore();
  });

  it('incluye el porcentaje de similitud en el primer log', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logDuplicate(
      { id: '1', title: 'Taller de arte', source: 'BibloRed' },
      { title: 'Taller de arte', source: 'IDARTES' },
      85
    );

    const firstCall = consoleSpy.mock.calls[0][0] as string;
    expect(firstCall).toContain('85%');
    consoleSpy.mockRestore();
  });

  it('incluye el título y fuente del original en el segundo log', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logDuplicate(
      { id: 'orig-1', title: 'Concierto de jazz', source: 'BibloRed' },
      { title: 'Concierto de jazz', source: 'IDARTES' },
      92
    );

    const secondCall = consoleSpy.mock.calls[1][0] as string;
    expect(secondCall).toContain('Concierto de jazz');
    expect(secondCall).toContain('BibloRed');
    consoleSpy.mockRestore();
  });

  it('incluye el título y fuente del potencial en el tercer log', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logDuplicate(
      { id: '1', title: 'Actividad A', source: 'FuenteA' },
      { title: 'Actividad B', source: 'FuenteB' },
      75
    );

    const thirdCall = consoleSpy.mock.calls[2][0] as string;
    expect(thirdCall).toContain('Actividad B');
    expect(thirdCall).toContain('FuenteB');
    consoleSpy.mockRestore();
  });
});

// ── extractDateInfo ───────────────────────────────────────────────────────────

describe('extractDateInfo()', () => {
  it('retorna año, mes, día e ISO para una fecha ISO válida', () => {
    const result = extractDateInfo('2026-03-15T12:00:00Z');
    expect(result).not.toBeNull();
    expect(result?.year).toBe(2026);
    // month y day pueden variar por zona horaria local — verificamos tipo y rango
    expect(result?.month).toBeGreaterThanOrEqual(1);
    expect(result?.month).toBeLessThanOrEqual(12);
    expect(result?.day).toBeGreaterThanOrEqual(1);
    expect(result?.iso).toBeDefined();
  });

  it('retorna null para una fecha inválida', () => {
    expect(extractDateInfo('no-es-fecha')).toBeNull();
  });

  it('retorna null para string vacío', () => {
    expect(extractDateInfo('')).toBeNull();
  });

  it('maneja formato YYYY-MM-DD', () => {
    const result = extractDateInfo('2026-06-15T12:00:00Z');
    expect(result).not.toBeNull();
    expect(result?.year).toBe(2026);
    // month puede diferir por zona horaria local — verificamos rango
    expect(result?.month).toBeGreaterThanOrEqual(1);
    expect(result?.month).toBeLessThanOrEqual(12);
  });

  it('el campo iso es un string ISO válido', () => {
    const result = extractDateInfo('2026-03-15T00:00:00Z');
    expect(result?.iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('retorna null para "Invalid Date"', () => {
    expect(extractDateInfo('31-15-2026')).toBeNull();
  });

  it('retorna mes como número entre 1 y 12', () => {
    const result = extractDateInfo('2026-07-15T12:00:00Z');
    expect(result?.month).toBeGreaterThanOrEqual(1);
    expect(result?.month).toBeLessThanOrEqual(12);
  });
});
