import { describe, it, expect, vi } from 'vitest';
import { SITE_URL } from '@/config/site';

// vi.hoisted garantiza que las variables estén disponibles dentro del factory de vi.mock
const { mockActivityFindFirst, mockActivityFindMany, mockCategoryFindMany, mockCityFindMany } = vi.hoisted(() => {
  // findFirst → obtener la actividad más reciente para catalogLastMod
  const mockActivityFindFirst = vi.fn().mockResolvedValue({
    updatedAt: new Date('2026-03-21'),
  });

  // findMany → rutas individuales de actividad
  const mockActivityFindMany = vi.fn().mockResolvedValue([
    { id: 'act-1', title: 'Taller de Pintura', updatedAt: new Date('2026-03-20') },
    { id: 'act-2', title: 'Club de Lectura',    updatedAt: new Date('2026-03-21') },
  ]);

  // Categorías con nested activities (shape del sitemap S65)
  const mockCategoryFindMany = vi.fn().mockResolvedValue([
    {
      slug: 'arte-y-creatividad',
      activities: [{ activity: { updatedAt: new Date('2026-03-20') } }],
    },
  ]);

  // Ciudades con nested locations.activities (shape del sitemap S65)
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

  return { mockActivityFindFirst, mockActivityFindMany, mockCategoryFindMany, mockCityFindMany };
});

vi.mock('@/lib/db', () => ({
  prisma: {
    activity: {
      findFirst: mockActivityFindFirst,
      findMany:  mockActivityFindMany,
    },
    category: { findMany: mockCategoryFindMany },
    city:     { findMany: mockCityFindMany },
  },
}));

import sitemap from '../sitemap';

describe('sitemap()', () => {
  it('retorna un array de rutas', async () => {
    const result = await sitemap();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('incluye la ruta raíz con prioridad 1', async () => {
    const result = await sitemap();
    const home = result.find(r => r.url === `${SITE_URL}/`);
    expect(home).toBeDefined();
    expect(home?.priority).toBe(1);
  });

  it('incluye /actividades con prioridad 0.9', async () => {
    const result = await sitemap();
    const actividades = result.find(r => r.url === `${SITE_URL}/actividades`);
    expect(actividades).toBeDefined();
    expect(actividades?.priority).toBe(0.9);
  });

  it('incluye rutas legales (Centro de Confianza)', async () => {
    const result = await sitemap();
    const urls = result.map(r => r.url);
    expect(urls).toContain(`${SITE_URL}/privacidad`);
    expect(urls).toContain(`${SITE_URL}/terminos`);
    // Rutas actualizadas post-rebrand S65 (antes: /seguridad/datos)
    expect(urls).toContain(`${SITE_URL}/centro-de-confianza/datos`);
    expect(urls).toContain(`${SITE_URL}/centro-de-confianza/privacidad`);
    expect(urls).toContain(`${SITE_URL}/centro-de-confianza/terminos`);
  });

  it('incluye rutas dinámicas de actividades', async () => {
    const result = await sitemap();
    const urls = result.map(r => r.url);
    // Las URLs incluyen el UUID + slug del título (formato canónico)
    expect(urls.some(u => u.includes('/actividad/act-1'))).toBe(true);
    expect(urls.some(u => u.includes('/actividad/act-2'))).toBe(true);
  });

  it('las rutas de actividades tienen prioridad 0.8', async () => {
    const result = await sitemap();
    const actRoute = result.find(r => r.url.includes('/actividad/act-1'));
    expect(actRoute?.priority).toBe(0.8);
  });

  it('las rutas de actividades tienen changeFrequency weekly', async () => {
    const result = await sitemap();
    const actRoute = result.find(r => r.url.includes('/actividad/act-1'));
    expect(actRoute?.changeFrequency).toBe('weekly');
  });

  it('usa la fecha updatedAt de la actividad como lastModified', async () => {
    const result = await sitemap();
    const actRoute = result.find(r => r.url.includes('/actividad/act-1'));
    expect(actRoute?.lastModified).toEqual(new Date('2026-03-20'));
  });

  it('incluye rutas de categoría con slug correcto', async () => {
    const result = await sitemap();
    const urls = result.map(r => r.url);
    expect(urls).toContain(`${SITE_URL}/actividades/categoria/arte-y-creatividad`);
  });

  it('incluye rutas de ciudad con slug correcto', async () => {
    const result = await sitemap();
    const urls = result.map(r => r.url);
    expect(urls).toContain(`${SITE_URL}/actividades/bogota`);
    expect(urls).toContain(`${SITE_URL}/actividades/medellin`);
  });

  it('NO incluye rutas privadas (/admin, /perfil, /login)', async () => {
    const result = await sitemap();
    const urls = result.map(r => r.url);
    expect(urls.every(u => !u.includes('/admin'))).toBe(true);
    expect(urls.every(u => !u.includes('/perfil'))).toBe(true);
    expect(urls.every(u => !u.includes('/login'))).toBe(true);
  });
});
