/**
 * GET /api/activities/category-counts
 *
 * Conteos de actividades por categoría con filtros de calidad y ciudad.
 * Usado por CategoryCountsIsland en el home para mostrar conteos exactos
 * según la ciudad del usuario (leída de localStorage en cliente).
 *
 * Query params:
 *   ids      — IDs de categorías (repetible: ids=xxx&ids=yyy)
 *   cityId   — Ciudad del usuario (opcional; sin cityId → conteo global)
 *
 * Response: { [categoryId]: count }
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildActivityWhere } from '@/modules/activities/activity-filters';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const categoryIds = searchParams.getAll('ids').filter(Boolean);
  const cityId      = searchParams.get('cityId') || undefined;

  if (!categoryIds.length) {
    return NextResponse.json({});
  }

  // Mismo filtro de calidad que listActivities en relevance
  const badDomainSources = await prisma.sourceHealth.findMany({
    where: { score: { lt: 0.1 } },
    select: { source: true },
  });
  const badDomains = badDomainSources.map((h) => h.source);

  const activityFilter = buildActivityWhere({ status: 'ACTIVE', cityId, badDomains });

  // Una query — mismo patrón que home page category counts
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: {
      id: true,
      _count: {
        select: {
          activities: { where: { activity: activityFilter } },
        },
      },
    },
  });

  const result: Record<string, number> = {};
  for (const cat of categories) {
    result[cat.id] = cat._count.activities;
  }

  return NextResponse.json(result, {
    headers: {
      // Cache 60s en CDN — los conteos no cambian por segundo
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
    },
  });
}
