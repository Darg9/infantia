// =============================================================================
// sitemap.ts — Generador de sitemap indexado para Crawl Governance
// Implementa partición híbrida (semántica + rolling chunks) para escalar a V3.
// =============================================================================

import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { SITE_URL } from '@/config/site';
import { activityPath } from '@/lib/activity-url';
import { slugify } from '@/lib/slugify';

export const revalidate = 3600; // TTL global de 1h

const CHUNK_SIZE = 2000;
const baseUrl = SITE_URL;

// =============================================================================
// 1. Generador de Sitemaps (El Sitemap Index)
// =============================================================================
export async function generateSitemaps() {
  const sitemaps = [{ id: 'core' }, { id: 'cities' }, { id: 'categories' }];

  // Contar actividades activas y canónicas (Crawl Governance: no expirados, no alias)
  const activeCount = await prisma.activity.count({
    where: { 
      status: 'ACTIVE',
      canonicalId: null, // Solo masters
    },
  });

  const activeChunks = Math.ceil(activeCount / CHUNK_SIZE);
  for (let i = 0; i < activeChunks; i++) {
    sitemaps.push({ id: `events-active-${i}` });
  }

  return sitemaps;
}

// =============================================================================
// 2. Resolutores por Partición
// =============================================================================
export default async function sitemap({
  id,
}: {
  id: string;
}): Promise<MetadataRoute.Sitemap> {
  const latestActivity = await prisma.activity.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  });
  const catalogLastMod = latestActivity?.updatedAt ?? new Date();

  // ---------------------------------------------------------------------------
  // Partición: CORE (Rutas estáticas y legales)
  // ---------------------------------------------------------------------------
  if (id === 'core') {
    const LEGAL_DATE  = new Date('2026-04-07');
    const STATIC_DATE = new Date('2026-04-07');

    return [
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
  }

  // ---------------------------------------------------------------------------
  // Partición: CATEGORIES
  // ---------------------------------------------------------------------------
  if (id === 'categories') {
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

    return categories.map((cat) => ({
      url: `${baseUrl}/actividades/categoria/${cat.slug}`,
      lastModified: cat.activities[0]?.activity.updatedAt ?? catalogLastMod,
      changeFrequency: 'daily' as const,
      priority: 0.85,
    }));
  }

  // ---------------------------------------------------------------------------
  // Partición: CITIES
  // ---------------------------------------------------------------------------
  if (id === 'cities') {
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

    return cities.map((city) => {
      const lastMod = city.locations[0]?.activities[0]?.updatedAt ?? catalogLastMod;
      return {
        url: `${baseUrl}/actividades/${slugify(city.name)}`,
        lastModified: lastMod,
        changeFrequency: 'daily' as const,
        priority: 0.85,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Partición: EVENTS-ACTIVE (Rolling Chunks)
  // ---------------------------------------------------------------------------
  if (id.startsWith('events-active-')) {
    const chunkIndex = parseInt(id.replace('events-active-', ''), 10);
    
    if (isNaN(chunkIndex)) return [];

    const activities = await prisma.activity.findMany({
      where: { 
        status: 'ACTIVE',
        canonicalId: null, // Crawl Governance: solo masters
      },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      skip: chunkIndex * CHUNK_SIZE,
      take: CHUNK_SIZE,
    });

    return activities.map((activity) => ({
      url: `${baseUrl}${activityPath(activity.id, activity.title)}`,
      lastModified: activity.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  }

  return [];
}
