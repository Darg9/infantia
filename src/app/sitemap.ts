import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://infantia.co';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let activities: { id: string; updatedAt: Date }[] = [];

  try {
    activities = await prisma.activity.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  } catch {
    // DB not available at build time — return static pages only
  }

  const activityEntries: MetadataRoute.Sitemap = activities.map((a) => ({
    url: `${SITE_URL}/actividades/${a.id}`,
    lastModified: a.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/actividades`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/privacidad`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terminos`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/tratamiento-datos`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/contacto`,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];

  return [...staticPages, ...activityEntries];
}
