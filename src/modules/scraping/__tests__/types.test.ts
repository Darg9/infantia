import { describe, it, expect } from 'vitest';
import { activityNLPResultSchema, discoveredActivityUrlsSchema } from '../types';

describe('activityNLPResultSchema', () => {
  const actividadValida = {
    title: 'Taller de pintura para niños',
    description: 'Aprende técnicas básicas de pintura',
    categories: ['Arte y Creatividad'],
    minAge: 5,
    maxAge: 12,
    price: 0,
    pricePeriod: 'FREE' as const,
    currency: 'COP',
    confidenceScore: 0.95,
  };

  it('valida una actividad correcta', () => {
    const result = activityNLPResultSchema.safeParse(actividadValida);
    expect(result.success).toBe(true);
  });

  it('falla si falta el título', () => {
    const { title, ...sinTitulo } = actividadValida;
    expect(activityNLPResultSchema.safeParse(sinTitulo).success).toBe(false);
  });

  it('falla si el título está vacío', () => {
    const result = activityNLPResultSchema.safeParse({ ...actividadValida, title: '' });
    expect(result.success).toBe(false);
  });

  it('falla si categories está vacío', () => {
    const result = activityNLPResultSchema.safeParse({ ...actividadValida, categories: [] });
    expect(result.success).toBe(false);
  });

  it('falla si confidenceScore > 1', () => {
    const result = activityNLPResultSchema.safeParse({ ...actividadValida, confidenceScore: 1.5 });
    expect(result.success).toBe(false);
  });

  it('falla si confidenceScore < 0', () => {
    const result = activityNLPResultSchema.safeParse({ ...actividadValida, confidenceScore: -0.1 });
    expect(result.success).toBe(false);
  });

  it('acepta null en description (.nullable lo permite; .default solo aplica a undefined)', () => {
    const result = activityNLPResultSchema.safeParse({ ...actividadValida, description: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeNull();
  });

  it('convierte null a undefined en campos opcionales de string', () => {
    const conLocation = {
      ...actividadValida,
      location: { address: null, city: 'Bogotá' },
    };
    const result = activityNLPResultSchema.safeParse(conLocation);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.location?.address).toBeUndefined();
  });

  it('falla si currency no tiene exactamente 3 caracteres', () => {
    const result = activityNLPResultSchema.safeParse({ ...actividadValida, currency: 'DOLAR' });
    expect(result.success).toBe(false);
  });

  it('falla si pricePeriod no es un valor válido', () => {
    const result = activityNLPResultSchema.safeParse({ ...actividadValida, pricePeriod: 'ANUAL' });
    expect(result.success).toBe(false);
  });

  it('valida los 4 valores de pricePeriod', () => {
    const periodos = ['PER_SESSION', 'MONTHLY', 'TOTAL', 'FREE'] as const;
    for (const periodo of periodos) {
      const result = activityNLPResultSchema.safeParse({ ...actividadValida, pricePeriod: periodo });
      expect(result.success).toBe(true);
    }
  });
});

describe('discoveredActivityUrlsSchema', () => {
  it('valida array de URLs', () => {
    const result = discoveredActivityUrlsSchema.safeParse({
      activityUrls: ['https://a.com', 'https://b.com'],
    });
    expect(result.success).toBe(true);
  });

  it('acepta array vacío', () => {
    const result = discoveredActivityUrlsSchema.safeParse({ activityUrls: [] });
    expect(result.success).toBe(true);
  });

  it('falla si falta activityUrls', () => {
    const result = discoveredActivityUrlsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
