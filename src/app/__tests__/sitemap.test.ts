import { describe, it, expect, vi } from 'vitest';
import { SITE_URL } from '@/config/site';

// vi.hoisted garantiza que las variables estén disponibles dentro del factory de vi.mock
const { mockActivityFindFirst, mockActivityFindMany, mockActivityCount, mockCategoryFindMany, mockCityFindMany } = vi.hoisted(() => {
  const mockActivityFindFirst = vi.fn().mockResolvedValue({
    updatedAt: new Date('2026-03-21'),
  });

  const mockActivityFindMany = vi.fn().mockResolvedValue([
    { id: 'act-1', title: 'Taller de Pintura', updatedAt: new Date('2026-03-20') },
    { id: 'act-2', title: 'Club de Lectura',    updatedAt: new Date('2026-03-21') },
  ]);

  const mockActivityCount = vi.fn().mockResolvedValue(5000);

  const mockCategoryFindMany = vi.fn().mockResolvedValue([
    {
      slug: 'arte-y-creatividad',
      activities: [{ activity: { updatedAt: new Date('2026-03-20') } }],
    },
  ]);

  const mockCityFindMany = vi.fn().mockResolvedValue([
    {
      name: 'Bogotá',
      locations: [{ activities: [{ updatedAt: new Date('2026-03-20') }] }],
    },
    {
      name: 'Medellín',
      locations: [],
    },
  ]);

  return { mockActivityFindFirst, mockActivityFindMany, mockActivityCount, mockCategoryFindMany, mockCityFindMany };
});

vi.mock('@/lib/db', () => ({
  prisma: {
    activity: {
      findFirst: mockActivityFindFirst,
      findMany:  mockActivityFindMany,
      count:     mockActivityCount,
    },
    category: { findMany: mockCategoryFindMany },
    city:     { findMany: mockCityFindMany },
  },
}));

import sitemap from '../sitemap';

describe('Sitemap unificado', () => {
  it('retorna rutas estáticas', async () => {
    const result = await sitemap();
    const urls = result.map(r => r.url);
    expect(urls).toContain(`${SITE_URL}/`);
    expect(urls).toContain(`${SITE_URL}/actividades`);
    expect(urls).toContain(`${SITE_URL}/centro-de-confianza`);
    expect(urls).toContain(`${SITE_URL}/centro-de-confianza/privacidad`);
    expect(urls).toContain(`${SITE_URL}/centro-de-confianza/terminos`);
    expect(urls).toContain(`${SITE_URL}/contacto`);
  });

  it('retorna rutas de categoría', async () => {
    const result = await sitemap();
    const urls = result.map(r => r.url);
    expect(urls).toContain(`${SITE_URL}/actividades/categoria/arte-y-creatividad`);
  });

  it('retorna rutas de ciudad', async () => {
    const result = await sitemap();
    const urls = result.map(r => r.url);
    expect(urls).toContain(`${SITE_URL}/actividades/bogota`);
    expect(urls).toContain(`${SITE_URL}/actividades/medellin`);
  });

  it('retorna rutas de actividades individuales', async () => {
    const result = await sitemap();
    const urls = result.map(r => r.url);
    expect(urls.some(u => u.includes('/actividad/act-1'))).toBe(true);
    expect(urls.some(u => u.includes('/actividad/act-2'))).toBe(true);
  });

  it('todos los entries tienen url, lastModified y priority', async () => {
    const result = await sitemap();
    for (const entry of result) {
      expect(typeof entry.url).toBe('string');
      expect(entry.lastModified).toBeDefined();
      expect(typeof entry.priority).toBe('number');
    }
  });
});
