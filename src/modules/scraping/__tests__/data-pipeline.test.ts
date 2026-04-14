// =============================================================================
// Tests: modules/scraping/data-pipeline.ts
// Pure function — no I/O, no mocks needed
// =============================================================================

import { describe, it, expect } from 'vitest';
import { runDataPipeline } from '../data-pipeline';
import type { ActivityNLPResult } from '../types';

// ── Fixture base válida ────────────────────────────────────────────────────────
const base: ActivityNLPResult = {
  title: 'Taller de arte para niños',
  description: 'Taller creativo en el centro cultural para todas las edades, garantizando diversión y aprendizaje.',
  categories: ['Arte'],
  confidenceScore: 0.9,
  minAge: 6,
  maxAge: 12,
  price: 0,
  currency: 'COP',
  pricePeriod: null,
  schedules: [],
  location: null,
  audience: 'KIDS',
};

// =============================================================================
// Validaciones obligatorias (invalid cases)
// =============================================================================
describe('runDataPipeline — validaciones de entrada', () => {
  it('invalida si título es "Sin título"', () => {
    const r = runDataPipeline({ ...base, title: 'Sin título' });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('title_invalid_or_missing');
  });

  it('invalida si título es null', () => {
    const r = runDataPipeline({ ...base, title: null as unknown as string });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('title_invalid_or_missing');
  });

  it('invalida si título tiene < 5 chars tras normalizar', () => {
    const r = runDataPipeline({ ...base, title: 'Art' });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('title_invalid_or_missing');
  });

  it('invalida si descripción está vacía', () => {
    const r = runDataPipeline({ ...base, description: '' });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('description_insufficient');
  });

  it('invalida si descripción tiene < 40 chars', () => {
    const r = runDataPipeline({ ...base, description: 'Texto corto.' });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('description_insufficient');
  });

  it('invalida si descripción no tiene letras (solo chars especiales)', () => {
    const r = runDataPipeline({ ...base, description: '!!! *** ??? --- ### 123 456 789 000 ~~~ ^^^ &&& @@@' });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('invalid_chars_only');
  });

  it('invalida si descripción es spam puro', () => {
    const r = runDataPipeline({ ...base, description: 'haz clic' });
    expect(r.valid).toBe(false);
    // primero falla description_insufficient (< 40 chars) antes de spam check
  });
});

// =============================================================================
// Pipeline válido — transformaciones
// =============================================================================
describe('runDataPipeline — transformaciones en datos válidos', () => {
  it('retorna valid=true para datos correctos', () => {
    const r = runDataPipeline(base);
    expect(r.valid).toBe(true);
  });

  it('normaliza título capitalizando primera letra', () => {
    const r = runDataPipeline({ ...base, title: 'taller de arte para niños' });
    expect(r.valid).toBe(true);
    expect(r.data.title[0]).toBe('T');
  });

  it('elimina ruido promocional al inicio/final del título', () => {
    const r = runDataPipeline({ ...base, title: '!!!Taller de arte para niños!!!' });
    expect(r.valid).toBe(true);
    expect(r.data.title).not.toMatch(/^!/);
    expect(r.data.title).not.toMatch(/!$/);
  });

  it('colapsa espacios múltiples en título', () => {
    const r = runDataPipeline({ ...base, title: 'Taller   de    arte    para    niños' });
    expect(r.valid).toBe(true);
    expect(r.data.title).not.toMatch(/\s{2,}/);
  });

  it('mapea categoría a bucket estandarizado', () => {
    const r = runDataPipeline({ ...base, categories: ['música'] });
    expect(r.valid).toBe(true);
    expect(r.data.categories).toContain('Música');
  });

  it('categorías vacías → General (línea 68)', () => {
    const r = runDataPipeline({ ...base, categories: [] });
    expect(r.valid).toBe(true);
    expect(r.data.categories).toContain('General');
  });

  it('categorías con valores falsy → General', () => {
    const r = runDataPipeline({ ...base, categories: [null as unknown as string, ''] });
    expect(r.valid).toBe(true);
    expect(r.data.categories).toContain('General');
  });

  it('categorías desconocidas → General', () => {
    const r = runDataPipeline({ ...base, categories: ['XYZ_desconocido_abc'] });
    expect(r.valid).toBe(true);
    expect(r.data.categories).toContain('General');
  });

  it('no duplica categorías si dos inputs mapean al mismo bucket', () => {
    const r = runDataPipeline({ ...base, categories: ['arte', 'artes', 'pintura'] });
    expect(r.valid).toBe(true);
    expect(r.data.categories.filter((c) => c === 'Arte')).toHaveLength(1);
  });

  it('swapea minAge/maxAge cuando están invertidos (línea 76)', () => {
    const r = runDataPipeline({ ...base, minAge: 12, maxAge: 6 });
    expect(r.valid).toBe(true);
    expect(r.data.minAge).toBe(6);
    expect(r.data.maxAge).toBe(12);
  });

  it('preserva edades correctas sin swap', () => {
    const r = runDataPipeline({ ...base, minAge: 3, maxAge: 10 });
    expect(r.valid).toBe(true);
    expect(r.data.minAge).toBe(3);
    expect(r.data.maxAge).toBe(10);
  });

  it('price=0 → pricePeriod=FREE', () => {
    const r = runDataPipeline({ ...base, price: 0, pricePeriod: null });
    expect(r.valid).toBe(true);
    expect(r.data.pricePeriod).toBe('FREE');
  });

  it('price=null + pricePeriod=FREE → price=0 (línea 85)', () => {
    const r = runDataPipeline({ ...base, price: null as unknown as number, pricePeriod: 'FREE' });
    expect(r.valid).toBe(true);
    expect(r.data.price).toBe(0);
  });

  it('infiere environment OUTDOOR desde texto', () => {
    const r = runDataPipeline({
      ...base,
      title: 'Campamento de verano para niños',
      description: 'Actividad en el parque al aire libre con naturaleza para todos los participantes inscritos.',
      environment: undefined,
    });
    expect(r.valid).toBe(true);
    expect(r.data.environment).toBe('OUTDOOR');
  });

  it('infiere environment INDOOR desde texto', () => {
    const r = runDataPipeline({
      ...base,
      title: 'Clase de música para niños',
      description: 'Clase bajo techo en el auditorio municipal para niños de todas las edades de la ciudad.',
      environment: undefined,
    });
    expect(r.valid).toBe(true);
    expect(r.data.environment).toBe('INDOOR');
  });

  it('infiere environment MIXED si hay keywords de ambos', () => {
    const r = runDataPipeline({
      ...base,
      title: 'Clase de música para niños',
      description: 'Actividad al aire libre y bajo techo en el museo para toda la familia este fin de semana.',
      environment: undefined,
    });
    expect(r.valid).toBe(true);
    expect(r.data.environment).toBe('MIXED');
  });

  it('respeta environment ya definido sin sobreescribir', () => {
    const r = runDataPipeline({ ...base, environment: 'INDOOR' });
    expect(r.valid).toBe(true);
    expect(r.data.environment).toBe('INDOOR');
  });
});
