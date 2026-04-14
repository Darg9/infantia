// =============================================================================
// Tests: modules/scraping/alerts.ts
// Pure function — no I/O, no mocks needed
// =============================================================================

import { describe, it, expect } from 'vitest';
import { getSystemStatus } from '../alerts';

describe('getSystemStatus', () => {
  it('retorna "healthy" cuando latest es null o undefined', () => {
    expect(getSystemStatus(null)).toBe('healthy');
    expect(getSystemStatus(undefined)).toBe('healthy');
  });

  it('retorna "over" cuando discardRate > 0.50', () => {
    expect(getSystemStatus({ discardRate: 0.60, avgLength: 50 })).toBe('over');
  });

  it('retorna "over" cuando avgLength > 75', () => {
    expect(getSystemStatus({ discardRate: 0.10, avgLength: 80 })).toBe('over');
  });

  it('retorna "under" cuando discardRate < 0.05', () => {
    expect(getSystemStatus({ discardRate: 0.02, avgLength: 50 })).toBe('under');
  });

  it('retorna "under" cuando avgLength < 40', () => {
    expect(getSystemStatus({ discardRate: 0.10, avgLength: 30 })).toBe('under');
  });

  it('retorna "healthy" para valores en rango normal', () => {
    expect(getSystemStatus({ discardRate: 0.15, avgLength: 55 })).toBe('healthy');
  });

  it('límite exacto discardRate=0.50 → "healthy" (no estrictamente mayor)', () => {
    expect(getSystemStatus({ discardRate: 0.50, avgLength: 50 })).toBe('healthy');
  });

  it('límite exacto avgLength=75 → "healthy" (no estrictamente mayor)', () => {
    expect(getSystemStatus({ discardRate: 0.10, avgLength: 75 })).toBe('healthy');
  });
});
