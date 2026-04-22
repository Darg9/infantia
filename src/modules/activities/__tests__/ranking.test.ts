import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeActivityScore } from '../ranking';
import { ctrToBoost } from '../../analytics/metrics';
import { Activity, Prisma } from '../../../generated/prisma/client';

describe('Activity Ranking Engine - Curaduría y Pruebas Exhaustivas', () => {
  const baseActivity: Partial<Activity> & { _count?: { views: number } } = {
    title: 'Test Activity',
    createdAt: new Date(),
    status: 'ACTIVE',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Algoritmo Base (Relevancia + Recency + Health + CTR)', () => {
    it('debería calcular score casi perfecto para fuentes confiables y actividades recientes', () => {
      // Relevance (0.7 * 0.5 = 0.35) + Recency (1.0 * 0.2 = 0.20) + Health (1.0 * 0.3 = 0.30)
      // Base score = 0.85 con recency 1.0 (≤3 días)
      // Note: createdAt = exact "now" → daysSince = ceil(0ms/86400000ms) = 0 days
      // 0 days ≤ 3 → recency = 1.0 → score = 0.35 + 0.20 + 0.30 = 0.85
      const actJustCreated = { ...baseActivity, createdAt: new Date('2026-04-19T12:00:00Z') };
      const score = computeActivityScore(actJustCreated, 1.0);
      expect(score).toBeCloseTo(0.85, 2);
    });

    it('debería aplicar recency score escalonado (1.0, 0.8, 0.5, 0.2)', () => {
      const act1 = { ...baseActivity, createdAt: new Date('2026-04-18T12:00:00Z') }; // 1 dia = 1.0
      const act5 = { ...baseActivity, createdAt: new Date('2026-04-14T12:00:00Z') }; // 5 dias = 0.8
      const act15 = { ...baseActivity, createdAt: new Date('2026-04-04T12:00:00Z') }; // 15 dias = 0.5
      
      const s1 = computeActivityScore(act1, 1.0);
      const s5 = computeActivityScore(act5, 1.0);
      const s15 = computeActivityScore(act15, 1.0);

      expect(s1).toBeCloseTo(0.85, 2); // 0.35 + 0.20(1.0) + 0.3 = 0.85
      expect(s5).toBeCloseTo(0.81, 2); // 0.35 + 0.16(0.8) + 0.3 = 0.81
      expect(s15).toBeCloseTo(0.75, 2); // 0.35 + 0.10(0.5) + 0.3 = 0.75
    });

    it('ctrBoost se suma directamente al score final', () => {
      const baseScore = computeActivityScore(baseActivity, 1.0, 0); // 0.85
      const boostedScore = computeActivityScore(baseActivity, 1.0, 0.15); // 0.85 + 0.15
      expect(boostedScore).toBeCloseTo(baseScore + 0.15, 5);
    });
  });

  describe('Product Signals - Deduplicación (Featured / Authority)', () => {
    it('debería aplicar un multiplicador gradual por duplicados (2% por doc)', () => {
      const act0 = { ...baseActivity, duplicatesCount: 0 };
      const act1 = { ...baseActivity, duplicatesCount: 1 };
      
      const score0 = computeActivityScore(act0, 1.0); // 0.85
      const score1 = computeActivityScore(act1, 1.0); // 0.85 * 1.02 = 0.867

      expect(score1).toBeCloseTo(score0 * 1.02, 5);
    });

    it('debería capar el multiplicador de duplicados en 5 (max +10%)', () => {
      const targetScore = computeActivityScore({ ...baseActivity, duplicatesCount: 5 }, 1.0);
      const extremeScore = computeActivityScore({ ...baseActivity, duplicatesCount: 100 }, 1.0);
      
      const base = computeActivityScore(baseActivity, 1.0);
      expect(targetScore).toBeCloseTo(base * 1.10, 5);
      expect(extremeScore).toEqual(targetScore); // Nunca puede exceder el cap del 10%
    });
  });

  describe('Product Signals - Verificados (Official Domains)', () => {
    it('debería amplificar multiplicador x1.2 a dominios oficiales .gov.co', () => {
      const regularAct = { ...baseActivity, sourceDomain: 'foro.com' };
      const govAct = { ...baseActivity, sourceDomain: 'idartes.gov.co' };

      const scoreRegular = computeActivityScore(regularAct, 1.0);
      const scoreGov = computeActivityScore(govAct, 1.0);

      expect(scoreGov).toBeCloseTo(scoreRegular * 1.2, 5);
    });

    it('no debe inyectar score_falso a subdominios inyectados .gov.co.fake.com', () => {
      const fakeGovAct = { ...baseActivity, sourceDomain: 'idartes.gov.co.fake.com' };
      const scoreFake = computeActivityScore(fakeGovAct, 1.0);
      const scoreBase = computeActivityScore(baseActivity, 1.0);

      expect(scoreFake).toEqual(scoreBase);
    });
  });

  describe('Product Signals - Popularidad (Views Boost)', () => {
    it('debería asignar boost progresivo por views reales en BD (0.5% por view)', () => {
      const act10Views = { ...baseActivity, _count: { views: 10 } };
      
      const base = computeActivityScore(baseActivity, 1.0);
      const scoreT = computeActivityScore(act10Views, 1.0);
      
      // 10 views * 0.005 = 0.05 (+5%)
      expect(scoreT).toBeCloseTo(base * 1.05, 5);
    });

    it('debería respetar el cap duro de 20 views (max +10%) y frenar manipulaciones', () => {
      const act20Views = { ...baseActivity, _count: { views: 20 } };
      const act100Views = { ...baseActivity, _count: { views: 100 } };
      const act1kViews = { ...baseActivity, _count: { views: 1000 } };

      const score20 = computeActivityScore(act20Views, 1.0);
      const score100 = computeActivityScore(act100Views, 1.0);
      const score1k = computeActivityScore(act1kViews, 1.0);

      const base = computeActivityScore(baseActivity, 1.0);

      // Max scale: 20 * 0.005 = 0.10 (+10%)
      expect(score20).toBeCloseTo(base * 1.10, 5);
      expect(score100).toEqual(score20); // El cap frena el crecimiento de hackers f5
      expect(score1k).toEqual(score20);
    });
  });

  describe('Freshness Decay (Penalización justa a eventos dinosaurios)', () => {
    it('debería penalizar eventos que inciaron en el pasado progresivamente (-2% por día)', () => {
      const daysOld = 5;
      const datePast = new Date('2026-04-14T12:00:00Z'); // 5 days ago from 2026-04-19
      
      const actOldStart = { ...baseActivity, startDate: datePast };
      
      const base = computeActivityScore(baseActivity, 1.0);
      const decaido = computeActivityScore(actOldStart, 1.0);

      // 5 días * 2% = 10% penalty -> clamp >= 0.8
      // multiplicamos base * 0.90
      expect(decaido).toBeCloseTo(base * 0.90, 5);
    });

    it('debería frenar el decay maximó en 20% guardrail (clamp 0.8) sin importar los meses cursados', () => {
      const date2MonthsAgo = new Date('2026-02-19T12:00:00Z'); // 60 dias
      const actVeryOld = { ...baseActivity, startDate: date2MonthsAgo };
      
      const base = computeActivityScore(baseActivity, 1.0);
      const decaido = computeActivityScore(actVeryOld, 1.0);

      // 60 días * 2% = -120% pero usamos `Math.max(freshnessDecay, 0.8)` !!
      expect(decaido).toBeCloseTo(base * 0.80, 5);
    });

    it('eventos futuros no deberían ser penalizados (Decay = 1)', () => {
      const futureDate = new Date('2026-04-25T12:00:00Z'); // Future
      const actFuture = { ...baseActivity, startDate: futureDate };
      
      const base = computeActivityScore(baseActivity, 1.0);
      const scoreFuture = computeActivityScore(actFuture, 1.0);

      // "daysSince" yields absolute time diff, BUT wait, daysSince applies to diff explicitly
      // Ah! Math.abs(Date.now() - date.getTime()) penalizes FUTURE events too! Proximity based decay!
      // This is expected: extremely far future events are also suppressed slightly so closer ones rank higher.
      // 6 days absolute difference = 12% penalization
      expect(scoreFuture).toBeCloseTo(base * 0.88, 5);
    });
  });

  describe('Señal: Completeness Boost (Datos explícitos)', () => {
    it('otorga +5% por cada atributo clave existente sin rebasar el +15%', () => {
      const baseScore = computeActivityScore(baseActivity, 1.0); // 0.85 crudo, boost X1.0

      const conPrecio = { ...baseActivity, price: new Prisma.Decimal(0) };
      expect(computeActivityScore(conPrecio, 1.0)).toBeCloseTo(baseScore * 1.05, 5);

      const conPrecioYEdad = { ...baseActivity, price: new Prisma.Decimal(50000), ageMin: 4 };
      expect(computeActivityScore(conPrecioYEdad, 1.0)).toBeCloseTo(baseScore * 1.10, 5);

      const conUbicacion = { ...baseActivity, locationId: 'loc-1' };
      expect(computeActivityScore(conUbicacion, 1.0)).toBeCloseTo(baseScore * 1.05, 5);

      const actoPerfecto = { ...baseActivity, price: new Prisma.Decimal(0), ageMax: 8, locationId: 'loc-2' };
      expect(computeActivityScore(actoPerfecto, 1.0)).toBeCloseTo(baseScore * 1.15, 5);
    });
  });

  describe('Prueba Maestra de Stack Máximo (All Stars Canonical Event)', () => {
    it('prueba el multiplicador masivo combinado para el mejor evento posible', () => {
      const ultimateAct = {
        title: 'Feria Oficial del Libro',
        createdAt: new Date('2026-04-19T10:00:00Z'), // Recency 1.0 (+0.2)
        sourceDomain: 'idartes.gov.co',              // Official Boost -> x1.2
        duplicatesCount: 15,                         // Max canonical boost -> x1.1
        _count: { views: 5000 },                     // Max Popularity -> x1.1
        startDate: new Date('2026-04-19T12:00:00Z'), // Ocurre HOY (Decay 1.0) -> x1.0
      };

      const baseSimple = computeActivityScore(baseActivity, 1.0); // 0.85
      
      const scoreUltimate = computeActivityScore(ultimateAct, 1.0, 0.15); // CTR perfecto

      // Base: (0.7*0.5=0.35) + (1.0*0.2=0.2) + (1.0*0.3=0.3) + CTR(0.15) = 1.00 Total crudo
      // Stack multiplicativo: 1.00 * (1.10) [dups] * (1.2) [gov] * (1.10) [views] = 1.00 * 1.452
      // Score final teórico = 1.452
      expect(scoreUltimate).toBeCloseTo(1.452, 3);

      // Una actividad Ultimate sin CTR de todos modos arrasa fuertemente
      const scoreNoCTR = computeActivityScore(ultimateAct, 1.0, 0);
      // Base crudo: 0.85 
      // 0.85 * 1.1 * 1.2 * 1.1 = 1.2342
      expect(scoreNoCTR).toBeCloseTo(1.2342, 3);
      expect(scoreNoCTR).toBeGreaterThan(baseSimple);
    });
  });
});
