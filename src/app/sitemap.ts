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

  // Fecha de la última actividad creada/modificada → proxy de "cuándo cambió el catálogo"
  const latestActivity = await prisma.activity.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  });
  const catalogLastMod = latestActivity?.updatedAt ?? new Date();

  // Fechas fijas para páginas que raramente cambian
  const LEGAL_DATE  = new Date('2026-04-07'); // fecha del rebrand HabitaPlan
  const STATIC_DATE = new Date('2026-04-07');

  // ── Rutas estáticas ──────────────────────────────────────────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`,         lastModified: catalogLastMod, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${baseUrl}/actividades`, lastModified: catalogLastMod, changeFrequency: 'hourly', priority: 0.9 },
    // Landings SEO de público
    { url: `${baseUrl}/actividades/publico/ninos`,   lastModified: catalogLastMod, changeFrequency: 'daily', priority: 0.85 },
    { url: `${baseUrl}/actividades/publico/familia`, lastModified: catalogLastMod, changeFrequency: 'daily', priority: 0.85 },
    { url: `${baseUrl}/actividades/publico/adultos`, lastModified: catalogLastMod, changeFrequency: 'daily', priority: 0.85 },
    // Landings SEO de precio
    { url: `${baseUrl}/actividades/precio/gratis`,   lastModified: catalogLastMod, changeFrequency: 'daily', priority: 0.85 },
    { url: `${baseUrl}/actividades/precio/pagas`,    lastModified: catalogLastMod, changeFrequency: 'daily', priority: 0.85 },
    // Páginas de contacto/contribución
    { url: `${baseUrl}/contacto`,    lastModified: STATIC_DATE, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/contribuir`,  lastModified: STATIC_DATE, changeFrequency: 'monthly', priority: 0.7 },
    // Legales
    { url: `${baseUrl}/privacidad`,                     lastModified: LEGAL_DATE, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${baseUrl}/terminos`,                       lastModified: LEGAL_DATE, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${baseUrl}/centro-de-confianza/datos`,      lastModified: LEGAL_DATE, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${baseUrl}/centro-de-confianza/privacidad`, lastModified: LEGAL_DATE, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${baseUrl}/centro-de-confianza/terminos`,   lastModified: LEGAL_DATE, changeFrequency: 'yearly', priority: 0.5 },
  ];

  // ── Landings SEO de categoría — lastModified = actividad más reciente ─────────
  const categories = await prisma.category.findMany({
    select: {
      slug: true,
      activities: {
        where: { activity: { status: 'ACTIVE' } },
        orderBy: { activity: { updatedAt: 'desc' } },
        take: 1,
        select: { activity: { select: { updatedAt: true } } },
      },
    },
  });

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${baseUrl}/actividades/categoria/${cat.slug}`,
    lastModified: cat.activities[0]?.activity.updatedAt ?? catalogLastMod,
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  // ── Landings SEO de ciudad — lastModified = actividad más reciente ───────────
  const cities = await prisma.city.findMany({
    where: {
      isActive: true,
      locations: { some: { activities: { some: { status: 'ACTIVE' } } } },
    },
    select: {
      name: true,
      locations: {
        select: {
          activities: {
            where: { status: 'ACTIVE' },
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: { updatedAt: true },
          },
        },
        take: 1,
      },
    },
  });

  const cityRoutes: MetadataRoute.Sitemap = cities.map((city) => {
    const lastMod = city.locations[0]?.activities[0]?.updatedAt ?? catalogLastMod;
    return {
      url: `${baseUrl}/actividades/${slugify(city.name)}`,
      lastModified: lastMod,
      changeFrequency: 'daily' as const,
      priority: 0.85,
    };
  });

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
