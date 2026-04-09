// =============================================================================
// GET /api/activities/suggestions?q=texto
// Retorna hasta 6 sugerencias de títulos para el autocompletado de búsqueda.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (q.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const activities = await prisma.activity.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        categories: {
          select: { category: { select: { name: true } } },
          take: 1,
        },
      },
      orderBy: { sourceConfidence: 'desc' },
      take: 6,
    });

    const suggestions = activities.map((a) => ({
      id: a.id,
      title: a.title,
      category: a.categories[0]?.category.name ?? null,
    }));

    return NextResponse.json({ suggestions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
