// =============================================================================
// GET /api/favorites — lista IDs de actividades favoritas del usuario
// POST /api/favorites — añade una actividad a favoritos
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSession, requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const user = await requireAuth()

    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      select: { id: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

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

    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      select: { id: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const body = await req.json()
    const { activityId } = body

    if (!activityId || typeof activityId !== 'string') {
      return NextResponse.json({ error: 'activityId requerido' }, { status: 400 })
    }

    // Verificar que la actividad existe
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true },
    })

    if (!activity) {
      return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 })
    }

    // Upsert: si ya existe, no lanza error
    await prisma.favorite.upsert({
      where: { userId_activityId: { userId: dbUser.id, activityId } },
      create: { userId: dbUser.id, activityId },
      update: {}, // nada que actualizar
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al guardar favorito' }, { status: 500 })
  }
}
