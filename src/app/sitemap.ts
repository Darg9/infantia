import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://infantia.co';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const activities = await prisma.activity.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

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
  ];

  return [...staticPages, ...activityEntries];
}
