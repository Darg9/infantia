// =============================================================================
// Tests: modules/scraping/adaptive-rules.ts
// Pure functions — no I/O, no mocks needed
// =============================================================================

import { describe, it, expect } from 'vitest';
import { getAdaptiveRules, getSourceRules } from '../adaptive-rules';

// =============================================================================
// getAdaptiveRules
// =============================================================================
describe('getAdaptiveRules', () => {
  it('retorna defaults cuando metrics es null', () => {
    const rules = getAdaptiveRules(null);
    expect(rules.forceStructured).toBe(false);
    expect(rules.minDescriptionLength).toBe(40);
  });

  it('retorna defaults cuando metrics es undefined', () => {
    const rules = getAdaptiveRules(undefined);
    expect(rules.forceStructured).toBe(false);
    expect(rules.minDescriptionLength).toBe(40);
  });

  it('forceStructured=true cuando pctShort > 20', () => {
    const rules = getAdaptiveRules({ pctShort: 25, pctNoise: 5 });
    expect(rules.forceStructured).toBe(true);
  });

  it('forceStructured=false cuando pctShort <= 20', () => {
    const rules = getAdaptiveRules({ pctShort: 20, pctNoise: 5 });
    expect(rules.forceStructured).toBe(false);
  });

  it('minDescriptionLength=60 cuando pctNoise > 15', () => {
    const rules = getAdaptiveRules({ pctShort: 5, pctNoise: 20 });
    expect(rules.minDescriptionLength).toBe(60);
  });

  it('minDescriptionLength=40 cuando pctNoise <= 15', () => {
    const rules = getAdaptiveRules({ pctShort: 5, pctNoise: 15 });
    expect(rules.minDescriptionLength).toBe(40);
  });
});

// =============================================================================
// getSourceRules
// =============================================================================
describe('getSourceRules', () => {
  it('retorna defaults cuando score es undefined', () => {
    const rules = getSourceRules(undefined);
    expect(rules.forceStructured).toBe(false);
    expect(rules.minDescriptionLength).toBe(40);
  });

  it('retorna defaults cuando score es null', () => {
    const rules = getSourceRules(null);
    expect(rules.forceStructured).toBe(false);
    expect(rules.minDescriptionLength).toBe(40);
  });

  it('score < 0.4 → forceStructured=true + minLength=80', () => {
    const rules = getSourceRules(0.3);
    expect(rules.forceStructured).toBe(true);
    expect(rules.minDescriptionLength).toBe(80);
  });

  it('score exactamente 0 → usa defaults (score === 0 es falsy pero permitido)', () => {
    // score=0 no dispara el guard (!score && score !== 0) — entra al if score < 0.4
    const rules = getSourceRules(0);
    expect(rules.forceStructured).toBe(true);
    expect(rules.minDescriptionLength).toBe(80);
  });

  it('score > 0.8 → forceStructured=false + minLength=30', () => {
    const rules = getSourceRules(0.9);
    expect(rules.forceStructured).toBe(false);
    expect(rules.minDescriptionLength).toBe(30);
  });

  it('score entre 0.4 y 0.8 → defaults', () => {
    const rules = getSourceRules(0.6);
    expect(rules.forceStructured).toBe(false);
    expect(rules.minDescriptionLength).toBe(40);
  });

  it('score exactamente 0.4 → defaults (no es < 0.4)', () => {
    const rules = getSourceRules(0.4);
    expect(rules.forceStructured).toBe(false);
    expect(rules.minDescriptionLength).toBe(40);
  });

  it('score exactamente 0.8 → defaults (no es > 0.8)', () => {
    const rules = getSourceRules(0.8);
    expect(rules.forceStructured).toBe(false);
    expect(rules.minDescriptionLength).toBe(40);
  });
});
