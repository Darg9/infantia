// =============================================================================
// sitemap.ts — Generador de sitemap dinámico para SEO
// Next.js App Router route que retorna XML válido
// =============================================================================

import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { SITE_URL } from '@/config/site';
import { activityPath } from '@/lib/activity-url';
import { slugify } from '@/lib/slugify';

export const revalidate = 3600; // Revalidar cada hora

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  // ── Rutas estáticas ──────────────────────────────────────────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`,                   lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${baseUrl}/actividades`,         lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.9 },
    // Landings SEO de público
    { url: `${baseUrl}/actividades/publico/ninos`,   lastModified: new Date(), changeFrequency: 'daily', priority: 0.85 },
    { url: `${baseUrl}/actividades/publico/familia`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.85 },
    { url: `${baseUrl}/actividades/publico/adultos`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.85 },
    // Landings SEO de precio
    { url: `${baseUrl}/actividades/precio/gratis`,   lastModified: new Date(), changeFrequency: 'daily', priority: 0.85 },
    { url: `${baseUrl}/actividades/precio/pagas`,    lastModified: new Date(), changeFrequency: 'daily', priority: 0.85 },
    // Páginas legales y contacto
    { url: `${baseUrl}/contacto`,           lastModified: new Date(), changeFrequency: 'monthly',  priority: 0.7 },
    { url: `${baseUrl}/contribuir`,         lastModified: new Date(), changeFrequency: 'monthly',  priority: 0.7 },
    { url: `${baseUrl}/privacidad`,         lastModified: new Date(), changeFrequency: 'yearly',   priority: 0.5 },
    { url: `${baseUrl}/terminos`,           lastModified: new Date(), changeFrequency: 'yearly',   priority: 0.5 },
    { url: `${baseUrl}/seguridad/datos`,  lastModified: new Date(), changeFrequency: 'yearly',   priority: 0.5 },
  ];

  // ── Landings SEO de categoría ────────────────────────────────────────────────
  const categories = await prisma.category.findMany({
    select: { slug: true },
  });

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${baseUrl}/actividades/categoria/${cat.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  // ── Landings SEO de ciudad — solo ciudades con contenido real ──────���────────
  // No indexar ciudades vacías: Google penaliza páginas sin contenido relevante.
  const cities = await prisma.city.findMany({
    where: {
      isActive: true,
      locations: { some: { activities: { some: { status: 'ACTIVE' } } } },
    },
    select: { name: true },
  });

  const cityRoutes: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${baseUrl}/actividades/${slugify(city.name)}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  // ── Actividades individuales ─────────────────────────────────────────────────
  const activities = await prisma.activity.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, title: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  const activityRoutes: MetadataRoute.Sitemap = activities.map((activity) => ({
    url: `${baseUrl}${activityPath(activity.id, activity.title)}`,
    lastModified: activity.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...cityRoutes, ...activityRoutes];
}
