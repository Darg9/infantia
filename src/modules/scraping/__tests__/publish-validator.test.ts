// =============================================================================
// Tests: src/modules/scraping/quality/publish-validator.ts
// Cubre todas las ramas: 3 REJECT, 3+ QUARANTINE, PUBLISH, tolerancias por dominio
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import type { ActivityNLPResult } from '../types';

// ── Mock de isDomainSpecificNoise ─────────────────────────────────────────────
// vi.hoisted garantiza que la referencia esté disponible cuando vi.mock se ejecuta (hoisting)
const mocks = vi.hoisted(() => ({
  isDomainSpecificNoise: vi.fn().mockReturnValue(false),
}));

vi.mock('../quality/domain-noise-rules', () => ({
  isDomainSpecificNoise: mocks.isDomainSpecificNoise,
}));

import { validateForPublish } from '../quality/publish-validator';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Construye un ActivityNLPResult mínimo válido. */
function makeActivity(overrides: Partial<ActivityNLPResult> = {}): ActivityNLPResult {
  return {
    title:          'Taller de pintura para niños en el parque',
    description:    'Actividad creativa al aire libre',
    isActivity:     true,
    categories:     ['General'],
    confidenceScore: 0.8,
    currency:       'COP',
    audience:       'ALL',
    schedules:      null,
    ...overrides,
  } as ActivityNLPResult;
}

/** Fecha ISO relativa a hoy (días positivos = futuro, negativos = pasado). */
function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const VALID_URL = 'https://idartes.gov.co/actividades/taller-pintura';

// ── REJECT: domain_noise_or_global_keyword ────────────────────────────────────

describe('REJECT — domain_noise_or_global_keyword', () => {
  it('rechaza cuando isDomainSpecificNoise devuelve true', () => {
    mocks.isDomainSpecificNoise.mockReturnValueOnce(true);
    const result = validateForPublish(makeActivity(), VALID_URL);
    expect(result).toEqual({ action: 'REJECT', reason: 'domain_noise_or_global_keyword' });
  });
});

// ── REJECT: future_date_hallucination ────────────────────────────────────────

describe('REJECT — future_date_hallucination', () => {
  it('rechaza fecha > 540 días en el futuro', () => {
    const activity = makeActivity({ schedules: [{ startDate: daysFromNow(541) }] });
    const result = validateForPublish(activity, VALID_URL);
    expect(result).toEqual({ action: 'REJECT', reason: 'future_date_hallucination' });
  });

  it('NO rechaza fecha exactamente en el límite (540 días)', () => {
    const activity = makeActivity({ schedules: [{ startDate: daysFromNow(540) }] });
    const result = validateForPublish(activity, VALID_URL);
    expect(result.action).not.toBe('REJECT');
  });
});

// ── REJECT: empty_content ────────────────────────────────────────────────────

describe('REJECT — empty_content', () => {
  it('rechaza título corto (<15 chars) + sin descripción + sin fecha', () => {
    const activity = makeActivity({
      title:       'Taller niños',   // 13 chars < 15
      description: null,
      schedules:   null,
    });
    const result = validateForPublish(activity, VALID_URL);
    expect(result).toEqual({ action: 'REJECT', reason: 'empty_content' });
  });

  it('NO rechaza título corto si tiene descripción', () => {
    const activity = makeActivity({
      title:       'Taller niños',
      description: 'Una descripción válida del taller',
      schedules:   null,
    });
    const result = validateForPublish(activity, VALID_URL);
    expect(result.reason).not.toBe('empty_content');
  });

  it('NO rechaza título corto si tiene fecha', () => {
    const activity = makeActivity({
      title:       'Taller niños',
      description: null,
      schedules:   [{ startDate: daysFromNow(5) }],
    });
    const result = validateForPublish(activity, VALID_URL);
    expect(result.reason).not.toBe('empty_content');
  });
});

// ── REJECT: extreme_past_date ────────────────────────────────────────────────

describe('REJECT — extreme_past_date', () => {
  it('rechaza fecha > 180 días en el pasado', () => {
    const activity = makeActivity({ schedules: [{ startDate: daysFromNow(-181) }] });
    const result = validateForPublish(activity, VALID_URL);
    expect(result).toEqual({ action: 'REJECT', reason: 'extreme_past_date' });
  });
});

// ── QUARANTINE: past_date_soft ───────────────────────────────────────────────

describe('QUARANTINE — past_date_soft', () => {
  it('pone en cuarentena evento vencido (default: 3 días tolerancia)', () => {
    const url = 'https://example.com/evento';
    const activity = makeActivity({ schedules: [{ startDate: daysFromNow(-4) }] });
    const result = validateForPublish(activity, url);
    expect(result.action).toBe('QUARANTINE');
    expect(result.reason).toMatch(/^past_date_soft_3d/);
  });

  it('aplica tolerancia extendida a idartes.gov.co (14 días)', () => {
    const url = 'https://idartes.gov.co/actividades/algo';
    // 10 días atrás: vence con default (3d) pero no con idartes (14d)
    const activity = makeActivity({ schedules: [{ startDate: daysFromNow(-10) }] });
    const result = validateForPublish(activity, url);
    // Con 14d tolerancia y 10d transcurridos → no debe cuarentenar por fecha
    expect(result.reason).not.toMatch(/past_date_soft/);
  });

  it('aplica tolerancia extendida a cinematecadebogota.gov.co (7 días)', () => {
    const url = 'https://cinematecadebogota.gov.co/pelicula/xyz';
    // 5 días atrás: vence con default (3d) pero no con cinemateca (7d)
    const activity = makeActivity({ schedules: [{ startDate: daysFromNow(-5) }] });
    const result = validateForPublish(activity, url);
    expect(result.reason).not.toMatch(/past_date_soft/);
  });

  it('aplica tolerancia correcta a subdominios de idartes.gov.co', () => {
    const url = 'https://sub.idartes.gov.co/evento';
    const activity = makeActivity({ schedules: [{ startDate: daysFromNow(-10) }] });
    const result = validateForPublish(activity, url);
    expect(result.reason).not.toMatch(/past_date_soft/);
  });
});

// ── QUARANTINE: missing_date ──────────────────────────────────────────────────

describe('QUARANTINE — missing_date', () => {
  it('cuarentena sin fecha y confianza baja (< 0.65)', () => {
    const activity = makeActivity({ schedules: null, confidenceScore: 0.5 });
    const result = validateForPublish(activity, VALID_URL);
    expect(result).toEqual({ action: 'QUARANTINE', reason: 'missing_date_low_confidence' });
  });

  it('cuarentena sin fecha y confianza alta (>= 0.65) — exposición permanente', () => {
    const activity = makeActivity({ schedules: null, confidenceScore: 0.75 });
    const result = validateForPublish(activity, VALID_URL);
    expect(result).toEqual({ action: 'QUARANTINE', reason: 'missing_date_high_confidence' });
  });

  it('límite exacto de confianza 0.65 → high_confidence', () => {
    const activity = makeActivity({ schedules: null, confidenceScore: 0.65 });
    const result = validateForPublish(activity, VALID_URL);
    expect(result.reason).toBe('missing_date_high_confidence');
  });
});

// ── QUARANTINE: medium_score ──────────────────────────────────────────────────

describe('QUARANTINE — medium_score', () => {
  it('cuarentena con fecha válida pero confianza < 0.4', () => {
    const activity = makeActivity({
      schedules:       [{ startDate: daysFromNow(5) }],
      confidenceScore: 0.35,
    });
    const result = validateForPublish(activity, VALID_URL);
    expect(result).toEqual({ action: 'QUARANTINE', reason: 'medium_score' });
  });

  it('límite exacto 0.4 → PUBLISH (no cuarentena)', () => {
    const activity = makeActivity({
      schedules:       [{ startDate: daysFromNow(5) }],
      confidenceScore: 0.4,
    });
    const result = validateForPublish(activity, VALID_URL);
    expect(result.action).toBe('PUBLISH');
  });
});

// ── PUBLISH: camino feliz ─────────────────────────────────────────────────────

describe('PUBLISH — camino feliz', () => {
  it('publica actividad con fecha futura y confianza alta', () => {
    const activity = makeActivity({
      schedules:       [{ startDate: daysFromNow(10) }],
      confidenceScore: 0.85,
    });
    const result = validateForPublish(activity, VALID_URL);
    expect(result).toEqual({ action: 'PUBLISH', reason: 'ok' });
  });

  it('publica actividad con fecha hoy', () => {
    const activity = makeActivity({
      schedules:       [{ startDate: daysFromNow(0) }],
      confidenceScore: 0.7,
    });
    const result = validateForPublish(activity, VALID_URL);
    expect(result).toEqual({ action: 'PUBLISH', reason: 'ok' });
  });

  it('publica actividad con fecha reciente dentro de tolerancia default (2 días atrás)', () => {
    const activity = makeActivity({
      schedules:       [{ startDate: daysFromNow(-2) }],
      confidenceScore: 0.8,
    });
    const result = validateForPublish(activity, 'https://example.com/evento');
    expect(result).toEqual({ action: 'PUBLISH', reason: 'ok' });
  });
});
