// =============================================================================
// GET /api/activities/[id]/ratings — calificaciones publicas de una actividad
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '10', 10) || 10))
  const skip = (page - 1) * limit

  const [ratings, total] = await Promise.all([
    prisma.rating.findMany({
      where: { activityId: id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: {
          select: { name: true, avatarUrl: true },
        },
      },
    }),
    prisma.rating.count({ where: { activityId: id } }),
  ])

  // Calculate average
  const avg = total > 0
    ? ratings.length > 0
      ? await prisma.rating.aggregate({
          where: { activityId: id },
          _avg: { score: true },
        }).then((r) => r._avg.score ?? 0)
      : 0
    : 0

  return NextResponse.json({
    ratings: ratings.map((r) => ({
      id: r.id,
      score: r.score,
      comment: r.comment,
      createdAt: r.createdAt,
      user: { name: r.user.name, avatarUrl: r.user.avatarUrl },
    })),
    total,
    average: Math.round(avg * 10) / 10,
    page,
    limit,
  })
}
