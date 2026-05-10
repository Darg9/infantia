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

  const mockActivityCount = vi.fn().mockResolvedValue(5000); // Para testear chunking

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

import sitemap, { generateSitemaps } from '../sitemap';

describe('Sitemap Partitioning (Crawl Governance)', () => {
  describe('generateSitemaps()', () => {
    it('genera particiones semánticas y chunks dinámicos', async () => {
      const result = await generateSitemaps();
      expect(result).toContainEqual({ id: 'core' });
      expect(result).toContainEqual({ id: 'cities' });
      expect(result).toContainEqual({ id: 'categories' });
      // Si el count es 5000 y CHUNK_SIZE es 2000, debería generar 3 chunks: 0, 1, 2
      expect(result).toContainEqual({ id: 'events-active-0' });
      expect(result).toContainEqual({ id: 'events-active-1' });
      expect(result).toContainEqual({ id: 'events-active-2' });
    });
  });

  describe('sitemap({ id }) resolvers', () => {
    it('id: core -> retorna rutas estáticas', async () => {
      const result = await sitemap({ id: 'core' });
      const urls = result.map(r => r.url);
      expect(urls).toContain(`${SITE_URL}/`);
      expect(urls).toContain(`${SITE_URL}/actividades`);
      expect(urls).toContain(`${SITE_URL}/privacidad`);
    });

    it('id: categories -> retorna rutas de categoría', async () => {
      const result = await sitemap({ id: 'categories' });
      const urls = result.map(r => r.url);
      expect(urls).toContain(`${SITE_URL}/actividades/categoria/arte-y-creatividad`);
    });

    it('id: cities -> retorna rutas de ciudad', async () => {
      const result = await sitemap({ id: 'cities' });
      const urls = result.map(r => r.url);
      expect(urls).toContain(`${SITE_URL}/actividades/bogota`);
      expect(urls).toContain(`${SITE_URL}/actividades/medellin`);
    });

    it('id: events-active-[n] -> retorna rutas de actividades en batches', async () => {
      const result = await sitemap({ id: 'events-active-0' });
      const urls = result.map(r => r.url);
      expect(urls.some(u => u.includes('/actividad/act-1'))).toBe(true);
      expect(urls.some(u => u.includes('/actividad/act-2'))).toBe(true);
    });

    it('maneja ids desconocidos retornando array vacío', async () => {
      const result = await sitemap({ id: 'unknown-id' });
      expect(result).toEqual([]);
    });

    it('maneja eventos activos inválidos retornando array vacío', async () => {
      const result = await sitemap({ id: 'events-active-invalid' });
      expect(result).toEqual([]);
    });
  });
});
