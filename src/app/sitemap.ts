// =============================================================================
// sitemap.ts — Generador de sitemap indexado para Crawl Governance
// Implementa partición híbrida (semántica + rolling chunks) para escalar a V3.
// =============================================================================

import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { SITE_URL } from '@/config/site';
import { activityPath } from '@/lib/activity-url';
import { slugify } from '@/lib/slugify';

export const dynamic = 'force-dynamic'; // No pre-renderizar en build (evita EMAXCONN)
export const revalidate = 3600; // TTL: revalida cada hora en background

const baseUrl = SITE_URL;

// =============================================================================
// Sitemap unificado (sin generateSitemaps — workaround bug Next.js 16 + Turbopack)
// Con ~400-5000 actividades estamos muy por debajo del límite de 50.000 URLs.
// Cuando superemos 50k actividades: migrar a particionado y usar Next.js actualizado.
// =============================================================================
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const latestActivity = await prisma.activity.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  });
  const catalogLastMod = latestActivity?.updatedAt ?? new Date();

  const LEGAL_DATE  = new Date('2026-04-07');
  const STATIC_DATE = new Date('2026-04-07');

  // ── Rutas estáticas y legales ─────────────────────────────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`,            lastModified: catalogLastMod, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${baseUrl}/actividades`, lastModified: catalogLastMod, changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${baseUrl}/actividades/publico/ninos`,   lastModified: catalogLastMod, changeFrequency: 'daily', priority: 0.85 },
    { url: `${baseUrl}/actividades/publico/familia`, lastModified: catalogLastMod, changeFrequency: 'daily', priority: 0.85 },
    { url: `${baseUrl}/actividades/publico/adultos`, lastModified: catalogLastMod, changeFrequency: 'daily', priority: 0.85 },
    { url: `${baseUrl}/actividades/precio/gratis`,   lastModified: catalogLastMod, changeFrequency: 'daily', priority: 0.85 },
    { url: `${baseUrl}/actividades/precio/pagas`,    lastModified: catalogLastMod, changeFrequency: 'daily', priority: 0.85 },
    { url: `${baseUrl}/contacto`,   lastModified: STATIC_DATE, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/contribuir`, lastModified: STATIC_DATE, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/centro-de-confianza`,            lastModified: LEGAL_DATE, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${baseUrl}/centro-de-confianza/privacidad`, lastModified: LEGAL_DATE, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${baseUrl}/centro-de-confianza/terminos`,   lastModified: LEGAL_DATE, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${baseUrl}/centro-de-confianza/datos`,      lastModified: LEGAL_DATE, changeFrequency: 'yearly', priority: 0.5 },
  ];

  // ── Categorías ────────────────────────────────────────────────────────────
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

  // ── Ciudades ──────────────────────────────────────────────────────────────
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
  const cityRoutes: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${baseUrl}/actividades/${slugify(city.name)}`,
    lastModified: city.locations[0]?.activities[0]?.updatedAt ?? catalogLastMod,
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  // ── Actividades individuales ──────────────────────────────────────────────
  const activities = await prisma.activity.findMany({
    where: { status: 'ACTIVE', canonicalId: null },
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
