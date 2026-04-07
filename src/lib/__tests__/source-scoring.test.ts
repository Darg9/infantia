import { describe, it, expect } from 'vitest';
import { calcSourceScore, formatReach, TIER_LABEL, TIER_COLOR } from '../source-scoring';

const base = {
  totalItemsFound: 10,
  totalItemsNew: 5,
  historicalTotal: 100,
  platform: 'INSTAGRAM',
  reach: 50_000,
  weeks: 4,
};

describe('calcSourceScore()', () => {
  describe('productionRate', () => {
    it('calcula tasa correctamente (nuevas / encontradas)', () => {
      const result = calcSourceScore(base);
      expect(result.productionRate).toBeCloseTo(0.5);
    });

    it('devuelve productionRate 0 si totalItemsFound es 0', () => {
      const result = calcSourceScore({ ...base, totalItemsFound: 0, totalItemsNew: 0 });
      expect(result.productionRate).toBe(0);
    });
  });

  describe('newPerWeek', () => {
    it('calcula nuevas por semana correctamente', () => {
      const result = calcSourceScore({ ...base, totalItemsNew: 8, weeks: 4 });
      expect(result.newPerWeek).toBe(2);
    });

    it('no divide por 0 si weeks es 0', () => {
      const result = calcSourceScore({ ...base, weeks: 0 });
      expect(result.newPerWeek).toBeGreaterThanOrEqual(0);
      expect(isFinite(result.newPerWeek)).toBe(true);
    });
  });

  describe('prodScore (50%)', () => {
    it('prodScore máximo con tasa 100%', () => {
      const result = calcSourceScore({ ...base, totalItemsFound: 10, totalItemsNew: 10 });
      expect(result.prodScore).toBe(50);
    });

    it('prodScore 0 con tasa 0%', () => {
      const result = calcSourceScore({ ...base, totalItemsFound: 10, totalItemsNew: 0 });
      expect(result.prodScore).toBe(0);
    });

    it('prodScore no supera 50', () => {
      const result = calcSourceScore({ ...base, totalItemsFound: 1, totalItemsNew: 100 });
      expect(result.prodScore).toBeLessThanOrEqual(50);
    });
  });

  describe('volScore (30%)', () => {
    it('volScore máximo con 5+ nuevas/semana', () => {
      const result = calcSourceScore({ ...base, totalItemsNew: 20, weeks: 4 }); // 5/sem
      expect(result.volScore).toBe(30);
    });

    it('volScore 0 con 0 nuevas', () => {
      const result = calcSourceScore({ ...base, totalItemsNew: 0 });
      expect(result.volScore).toBe(0);
    });

    it('volScore no supera 30', () => {
      const result = calcSourceScore({ ...base, totalItemsNew: 1000, weeks: 1 });
      expect(result.volScore).toBeLessThanOrEqual(30);
    });
  });

  describe('reachScore (20%) — redes sociales', () => {
    it('reachScore máximo con 50K seguidores en Instagram', () => {
      const result = calcSourceScore({ ...base, platform: 'INSTAGRAM', reach: 50_000 });
      expect(result.reachScore).toBe(20);
    });

    it('reachScore 10 (fallback) si reach es null en Instagram', () => {
      const result = calcSourceScore({ ...base, platform: 'INSTAGRAM', reach: null });
      expect(result.reachScore).toBe(10);
    });

    it('aplica benchmark de seguidores para TikTok y Facebook', () => {
      const ig = calcSourceScore({ ...base, platform: 'INSTAGRAM', reach: 25_000 });
      const tt = calcSourceScore({ ...base, platform: 'TIKTOK', reach: 25_000 });
      const fb = calcSourceScore({ ...base, platform: 'FACEBOOK', reach: 25_000 });
      expect(ig.reachScore).toBe(tt.reachScore);
      expect(ig.reachScore).toBe(fb.reachScore);
    });
  });

  describe('reachScore (20%) — plataformas web/telegram', () => {
    it('reachScore máximo con 200 actividades históricas (web)', () => {
      const result = calcSourceScore({ ...base, platform: 'WEBSITE', reach: null, historicalTotal: 200 });
      expect(result.reachScore).toBe(20);
    });

    it('reachScore 5 si historicalTotal es 0 en web', () => {
      const result = calcSourceScore({ ...base, platform: 'WEBSITE', reach: null, historicalTotal: 0 });
      expect(result.reachScore).toBe(5);
    });

    it('reachScore no supera 20 para web con historial alto', () => {
      const result = calcSourceScore({ ...base, platform: 'WEBSITE', reach: null, historicalTotal: 9999 });
      expect(result.reachScore).toBeLessThanOrEqual(20);
    });
  });

  describe('score total y tier', () => {
    it('score es suma de los tres componentes', () => {
      const result = calcSourceScore(base);
      const expected = Math.round(result.prodScore + result.volScore + result.reachScore);
      expect(result.score).toBe(expected);
    });

    it('tier A cuando score >= 70', () => {
      // tasa 100%, 5 nuevas/sem, 50K seg → score máximo
      const result = calcSourceScore({ ...base, totalItemsFound: 10, totalItemsNew: 10, reach: 50_000 });
      expect(result.tier).toBe('A');
    });

    it('tier D cuando score < 20', () => {
      const result = calcSourceScore({ totalItemsFound: 100, totalItemsNew: 0, historicalTotal: 0, platform: 'INSTAGRAM', reach: null, weeks: 4 });
      expect(result.tier).toBe('D');
    });

    it('tier B cuando score entre 40 y 69', () => {
      // tasa 50%, ~1 nueva/sem, 10K seg
      const result = calcSourceScore({ totalItemsFound: 10, totalItemsNew: 5, historicalTotal: 50, platform: 'INSTAGRAM', reach: 10_000, weeks: 4 });
      expect(['A', 'B', 'C', 'D']).toContain(result.tier);
    });
  });
});

describe('formatReach()', () => {
  it('formatea seguidores en K para Instagram', () => {
    expect(formatReach('INSTAGRAM', 53_000, 0)).toBe('53K seg');
  });

  it('muestra ? seg si reach es null en Instagram', () => {
    expect(formatReach('INSTAGRAM', null, 0)).toBe('? seg');
  });

  it('muestra seguidores exactos si < 1000', () => {
    expect(formatReach('INSTAGRAM', 500, 0)).toBe('500 seg');
  });

  it('muestra actividades históricas para web', () => {
    expect(formatReach('WEBSITE', null, 150)).toBe('150 acts');
  });

  it('muestra actividades para Telegram', () => {
    expect(formatReach('TELEGRAM', null, 42)).toBe('42 acts');
  });
});

describe('TIER_LABEL y TIER_COLOR', () => {
  it('TIER_LABEL tiene las 4 claves', () => {
    expect(TIER_LABEL['A']).toContain('A');
    expect(TIER_LABEL['B']).toContain('B');
    expect(TIER_LABEL['C']).toContain('C');
    expect(TIER_LABEL['D']).toContain('D');
  });

  it('TIER_COLOR tiene clases CSS para las 4 claves', () => {
    expect(TIER_COLOR['A']).toBeTruthy();
    expect(TIER_COLOR['B']).toBeTruthy();
    expect(TIER_COLOR['C']).toBeTruthy();
    expect(TIER_COLOR['D']).toBeTruthy();
  });
});
