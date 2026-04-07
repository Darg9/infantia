import { describe, it, expect } from 'vitest';
import { classifyUrlProductivity, preFilterUrls, getProductivityTier } from '../url-classifier';

describe('url-classifier', () => {
  describe('classifyUrlProductivity', () => {
    // ── NON-PRODUCTIVE URLs (score 0) ──
    it('rejects category pages', () => {
      const result = classifyUrlProductivity('https://example.com/categoria/deporte');
      expect(result.score).toBe(0);
      expect(result.isProductive).toBe(false);
    });

    it('rejects archive pages', () => {
      const result = classifyUrlProductivity('https://example.com/archive/2025');
      expect(result.score).toBe(0);
      expect(result.isProductive).toBe(false);
    });

    it('rejects binary files', () => {
      const pdfResult = classifyUrlProductivity('https://example.com/brochure.pdf');
      expect(pdfResult.score).toBe(0);

      const jpgResult = classifyUrlProductivity('https://example.com/photo.jpg');
      expect(jpgResult.score).toBe(0);
    });

    it('rejects infrastructure pages', () => {
      expect(classifyUrlProductivity('https://example.com/about/').score).toBe(0);
      expect(classifyUrlProductivity('https://example.com/contact/').score).toBe(0);
      expect(classifyUrlProductivity('https://example.com/admin/').score).toBe(0);
    });

    it('rejects pagination without content', () => {
      const result = classifyUrlProductivity('https://example.com/events?page=2');
      expect(result.score).toBe(0);
      expect(result.isProductive).toBe(false);
    });

    // ── PRODUCTIVE URLs (score >= 45) ──
    it('accepts event/activity pages', () => {
      const eventResult = classifyUrlProductivity('https://example.com/evento/taller-de-arte-2026');
      expect(eventResult.score).toBeGreaterThanOrEqual(45);
      expect(eventResult.isProductive).toBe(true);

      const activityResult = classifyUrlProductivity('https://example.com/actividades/concierto');
      expect(activityResult.score).toBeGreaterThanOrEqual(45);
      expect(activityResult.isProductive).toBe(true);
    });

    it('accepts pages with dates', () => {
      const result = classifyUrlProductivity('https://example.com/evento/2026-04-15');
      expect(result.score).toBeGreaterThanOrEqual(45);
      expect(result.isProductive).toBe(true);
    });

    it('accepts workshop pages', () => {
      const result = classifyUrlProductivity('https://example.com/taller-pintura-ninos');
      expect(result.score).toBeGreaterThanOrEqual(45);
      expect(result.isProductive).toBe(true);
    });

    it('accepts pages with activity keywords', () => {
      expect(classifyUrlProductivity('https://example.com/curso-musica').score).toBeGreaterThanOrEqual(45);
      expect(classifyUrlProductivity('https://example.com/concert-2026').score).toBeGreaterThanOrEqual(45);
      expect(classifyUrlProductivity('https://example.com/festival-arte').score).toBeGreaterThanOrEqual(45);
      expect(classifyUrlProductivity('https://example.com/torneo-futbol').score).toBeGreaterThanOrEqual(45);
    });

    it('accepts specific event IDs', () => {
      const result = classifyUrlProductivity('https://example.com/evento/12345');
      expect(result.score).toBeGreaterThanOrEqual(45);
      expect(result.isProductive).toBe(true);
    });

    it('penalizes generic URLs', () => {
      const result = classifyUrlProductivity('https://example.com/');
      expect(result.score).toBeLessThan(45);
      expect(result.isProductive).toBe(false);
    });

    it('scores partial matches lower than exact matches', () => {
      const exact = classifyUrlProductivity('https://example.com/taller-gratuito-ninos-10-anos');
      const partial = classifyUrlProductivity('https://example.com/items/list');
      expect(exact.score).toBeGreaterThan(partial.score);
    });

    // ── EDGE CASES ──
    it('handles URLs with time format (HH:MM)', () => {
      const result = classifyUrlProductivity('https://example.com/evento-14:30-concierto');
      expect(result.score).toBeGreaterThanOrEqual(45);
    });

    it('handles URLs with multiple keywords', () => {
      const result = classifyUrlProductivity('https://example.com/taller-musica-ninos-2026-04-15');
      expect(result.score).toBeGreaterThanOrEqual(60); // Multiple indicators
    });

    it('case insensitive matching', () => {
      const lower = classifyUrlProductivity('https://example.com/EVENTO/concierto');
      const upper = classifyUrlProductivity('https://example.com/evento/CONCIERTO');
      expect(lower.score).toBe(upper.score);
    });
  });

  describe('preFilterUrls', () => {
    it('separates productive and non-productive URLs', () => {
      const urls = [
        'https://example.com/evento/concierto-2026', // productive
        'https://example.com/category/arte', // non-productive
        'https://example.com/taller-musica', // productive
        'https://example.com/archive/', // non-productive
        'https://example.com/events/123', // productive
      ];

      const result = preFilterUrls(urls, 45);

      expect(result.kept.length).toBeGreaterThan(0);
      expect(result.filtered.length).toBeGreaterThan(0);
      expect(result.kept.length + result.filtered.length).toBe(5);
    });

    it('returns statistics', () => {
      const urls = [
        'https://example.com/evento/1',
        'https://example.com/category/',
        'https://example.com/taller-2',
      ];

      const result = preFilterUrls(urls);

      expect(result.stats.total).toBe(3);
      expect(result.stats.kept).toBeGreaterThanOrEqual(0);
      expect(result.stats.filtered).toBeGreaterThanOrEqual(0);
      expect(result.stats.reductionPct).toBeGreaterThanOrEqual(0);
      expect(result.stats.reductionPct).toBeLessThanOrEqual(100);
    });

    it('includes scores for each URL', () => {
      const urls = ['https://example.com/evento/1', 'https://example.com/category/'];
      const result = preFilterUrls(urls);

      expect(result.stats.scores.length).toBe(2);
      expect(result.stats.scores[0]).toHaveProperty('url');
      expect(result.stats.scores[0]).toHaveProperty('score');
      expect(result.stats.scores[0]).toHaveProperty('reason');
    });

    it('respects custom threshold', () => {
      const urls = [
        'https://example.com/evento-parcial-match', // score ~50
        'https://example.com/taller', // score ~50
      ];

      const resultLow = preFilterUrls(urls, 40);
      const resultHigh = preFilterUrls(urls, 60);

      expect(resultLow.kept.length).toBeGreaterThanOrEqual(resultHigh.kept.length);
    });

    it('handles empty URL list', () => {
      const result = preFilterUrls([]);

      expect(result.kept).toEqual([]);
      expect(result.filtered).toEqual([]);
      expect(result.stats.total).toBe(0);
      expect(result.stats.reductionPct).toBe(0);
    });

    it('calculates reduction percentage correctly', () => {
      const urls = [
        'https://example.com/category/1',
        'https://example.com/category/2',
        'https://example.com/category/3',
        'https://example.com/categoria/4',
        'https://example.com/evento/taller',
      ];

      const result = preFilterUrls(urls);

      expect(result.stats.reductionPct).toBe(
        Math.round((result.stats.filtered / 5) * 100),
      );
    });
  });

  describe('getProductivityTier', () => {
    it('returns HIGH for score >= 70', () => {
      expect(getProductivityTier(100)).toBe('HIGH');
      expect(getProductivityTier(70)).toBe('HIGH');
    });

    it('returns MEDIUM for score 45-69', () => {
      expect(getProductivityTier(69)).toBe('MEDIUM');
      expect(getProductivityTier(45)).toBe('MEDIUM');
    });

    it('returns LOW for score 20-44', () => {
      expect(getProductivityTier(44)).toBe('LOW');
      expect(getProductivityTier(20)).toBe('LOW');
    });

    it('returns REJECT for score < 20', () => {
      expect(getProductivityTier(19)).toBe('REJECT');
      expect(getProductivityTier(0)).toBe('REJECT');
    });
  });

  // ── REAL-WORLD SCENARIOS ──
  describe('real-world scenarios', () => {
    it('filters Banrep-like URLs', () => {
      // Simular URLs de Banrep que no son eventos
      const banrepUrls = [
        'https://banrepcultural.org/ibague/actividades/123', // productive
        'https://banrepcultural.org/ibague/', // non-productive
        'https://banrepcultural.org/ibague/category/', // non-productive
        'https://banrepcultural.org/ibague/concierto-2026', // productive
        'https://banrepcultural.org/page/2', // non-productive
      ];

      const result = preFilterUrls(banrepUrls);

      // Debería filtrar al menos 60% de URLs no productivas
      expect(result.stats.reductionPct).toBeGreaterThanOrEqual(40);
      expect(result.kept.length).toBeGreaterThan(0);
    });

    it('preserves high-quality Instagram event URLs', () => {
      const igUrls = [
        'https://instagram.com/p/ABC123/', // specific post
        'https://instagram.com/evento-taller', // keyword
        'https://instagram.com/concierto-2026-04-15', // date + keyword
      ];

      const result = preFilterUrls(igUrls);

      // High-quality sources should have few filters
      expect(result.stats.reductionPct).toBeLessThan(50);
    });

    it('handles mixed quality URL lists', () => {
      const mixedUrls = [
        'https://example.com/evento/123',
        'https://example.com/category/',
        'https://example.com/taller-musica',
        'https://example.com/admin/',
        'https://example.com/concierto-ninos-2026',
        'https://example.com/about/',
      ];

      const result = preFilterUrls(mixedUrls);

      // Should keep ~50-60% and filter ~40-50%
      expect(result.kept.length).toBeGreaterThan(0);
      expect(result.filtered.length).toBeGreaterThan(0);
    });
  });
});
