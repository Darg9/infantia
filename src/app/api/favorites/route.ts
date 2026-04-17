// =============================================================================
// GET /api/favorites — lista IDs de actividades favoritas del usuario
// POST /api/favorites — añade una actividad a favoritos
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSession, requireAuth, getOrCreateDbUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const user = await requireAuth()

    const dbUser = await getOrCreateDbUser(user)

    const favorites = await prisma.favorite.findMany({
      where: { userId: dbUser.id },
      select: { activityId: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ favoriteIds: favorites.map((f) => f.activityId) })
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const dbUser = await getOrCreateDbUser(user)

    const body = await req.json()
    const { targetId, type = 'activity' } = body

    if (!targetId || typeof targetId !== 'string') {
      return NextResponse.json({ error: 'targetId requerido' }, { status: 400 })
    }

    if (type === 'activity') {
      const activity = await prisma.activity.findUnique({
        where: { id: targetId },
        select: { id: true },
      })
      if (!activity) {
        return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 })
      }
      
      const existing = await prisma.favorite.findFirst({
        where: { userId: dbUser.id, activityId: targetId }
      })
      if (!existing) {
        await prisma.favorite.create({
          data: { userId: dbUser.id, activityId: targetId }
        })
      }
    } else if (type === 'place') {
      const location = await prisma.location.findUnique({
        where: { id: targetId },
        select: { id: true },
      })
      if (!location) {
        return NextResponse.json({ error: 'Lugar no encontrado' }, { status: 404 })
      }

      const existing = await prisma.favorite.findFirst({
        where: { userId: dbUser.id, locationId: targetId }
      })
      if (!existing) {
        await prisma.favorite.create({
          data: { userId: dbUser.id, locationId: targetId }
        })
      }
    } else {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }



    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al guardar favorito' }, { status: 500 })
  }
}
