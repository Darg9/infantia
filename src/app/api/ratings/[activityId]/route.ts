// =============================================================================
// GET /api/ratings/[activityId] — calificacion del usuario para una actividad
// DELETE /api/ratings/[activityId] — elimina la calificacion del usuario
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

type RouteParams = { params: Promise<{ activityId: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { activityId } = await params

    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      select: { id: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const rating = await prisma.rating.findUnique({
      where: { userId_activityId: { userId: dbUser.id, activityId } },
    })

    return NextResponse.json({ rating })
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { activityId } = await params

    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      select: { id: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const existing = await prisma.rating.findUnique({
      where: { userId_activityId: { userId: dbUser.id, activityId } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Calificacion no encontrada' }, { status: 404 })
    }

    await prisma.rating.delete({
      where: { userId_activityId: { userId: dbUser.id, activityId } },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar calificacion' }, { status: 500 })
  }
}
