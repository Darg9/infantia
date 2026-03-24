import { describe, it, expect, vi } from 'vitest';

// vi.hoisted garantiza que las variables estén disponibles dentro del factory de vi.mock
const { mockFindMany } = vi.hoisted(() => {
  const mockFindMany = vi.fn().mockResolvedValue([
    { id: 'act-1', updatedAt: new Date('2026-03-20') },
    { id: 'act-2', updatedAt: new Date('2026-03-21') },
  ]);
  return { mockFindMany };
});

vi.mock('@/lib/db', () => ({
  prisma: {
    activity: { findMany: mockFindMany },
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
    const home = result.find(r => r.url === 'https://infantia.app/');
    expect(home).toBeDefined();
    expect(home?.priority).toBe(1);
  });

  it('incluye /actividades con prioridad 0.9', async () => {
    const result = await sitemap();
    const actividades = result.find(r => r.url === 'https://infantia.app/actividades');
    expect(actividades).toBeDefined();
    expect(actividades?.priority).toBe(0.9);
  });

  it('incluye rutas legales', async () => {
    const result = await sitemap();
    const urls = result.map(r => r.url);
    expect(urls).toContain('https://infantia.app/privacidad');
    expect(urls).toContain('https://infantia.app/terminos');
    expect(urls).toContain('https://infantia.app/tratamiento-datos');
  });

  it('incluye rutas dinámicas de actividades', async () => {
    const result = await sitemap();
    const urls = result.map(r => r.url);
    expect(urls).toContain('https://infantia.app/actividades/act-1');
    expect(urls).toContain('https://infantia.app/actividades/act-2');
  });

  it('las rutas de actividades tienen prioridad 0.8', async () => {
    const result = await sitemap();
    const actRoute = result.find(r => r.url.includes('/actividades/act-1'));
    expect(actRoute?.priority).toBe(0.8);
  });

  it('las rutas de actividades tienen changeFrequency weekly', async () => {
    const result = await sitemap();
    const actRoute = result.find(r => r.url.includes('/actividades/act-1'));
    expect(actRoute?.changeFrequency).toBe('weekly');
  });

  it('usa la fecha updatedAt de la actividad como lastModified', async () => {
    const result = await sitemap();
    const actRoute = result.find(r => r.url.includes('/actividades/act-1'));
    expect(actRoute?.lastModified).toEqual(new Date('2026-03-20'));
  });

  it('NO incluye rutas privadas (/admin, /perfil, /login)', async () => {
    const result = await sitemap();
    const urls = result.map(r => r.url);
    expect(urls.every(u => !u.includes('/admin'))).toBe(true);
    expect(urls.every(u => !u.includes('/perfil'))).toBe(true);
    expect(urls.every(u => !u.includes('/login'))).toBe(true);
  });
});
