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
 *
 * Implementación: activity.count() paralelo por categoría — usa buildActivityWhere
 * directamente, igual que listActivities(). Garantiza consistencia total con los
 * resultados reales.
 *
 * ⚠️ NO usar category.findMany(_count.activities.where { activity: ... }) con cityId:
 * el OR con location.cityId anidado en _count falla silenciosamente en Prisma 7
 * devolviendo 0 cuando debería devolver decenas de actividades.
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

  // activity.count() paralelo por categoría — mismo WHERE que listActivities.
  // Esto garantiza que el conteo del home coincida con lo que el usuario verá
  // al hacer clic en la categoría.
  const entries = await Promise.all(
    categoryIds.map(async (categoryId) => {
      const count = await prisma.activity.count({
        where: buildActivityWhere({ status: 'ACTIVE', cityId, categoryId, badDomains }),
      });
      return [categoryId, count] as [string, number];
    }),
  );

  const result = Object.fromEntries(entries);

  return NextResponse.json(result, {
    headers: {
      // Cache 60s en CDN — los conteos no cambian por segundo
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
    },
  });
}
