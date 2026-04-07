// =============================================================================
// GET /api/ratings — lista calificaciones del usuario autenticado
// POST /api/ratings — crea o actualiza una calificacion
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { recalcProviderRating } from '@/lib/ratings'

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

    const ratings = await prisma.rating.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: 'desc' },
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            status: true,
          },
        },
      },
    })

    return NextResponse.json({ ratings })
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()

    // upsert: si el usuario está en Supabase Auth pero aún no en la BD, lo creamos
    const dbUser = await prisma.user.upsert({
      where: { supabaseAuthId: user.id },
      create: {
        supabaseAuthId: user.id,
        email: user.email ?? '',
        name: (user.user_metadata?.name as string | undefined) ?? user.email?.split('@')[0] ?? 'Usuario',
        role: 'PARENT',
      },
      update: {},
      select: { id: true },
    })

    const body = await req.json()
    const { activityId, score, comment } = body

    if (!activityId || typeof activityId !== 'string') {
      return NextResponse.json({ error: 'activityId requerido' }, { status: 400 })
    }

    if (typeof score !== 'number' || score < 1 || score > 5 || !Number.isInteger(score)) {
      return NextResponse.json({ error: 'score debe ser un entero entre 1 y 5' }, { status: 400 })
    }

    if (comment !== undefined && comment !== null) {
      if (typeof comment !== 'string' || comment.length > 500) {
        return NextResponse.json({ error: 'comment debe ser texto (max 500 caracteres)' }, { status: 400 })
      }
    }

    // Verify activity exists
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, providerId: true },
    })

    if (!activity) {
      return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 })
    }

    // Upsert rating
    const rating = await prisma.rating.upsert({
      where: { userId_activityId: { userId: dbUser.id, activityId } },
      create: {
        userId: dbUser.id,
        activityId,
        score,
        comment: comment?.trim() || null,
      },
      update: {
        score,
        comment: comment?.trim() || null,
      },
    })

    // Recalcular promedio del provider
    await recalcProviderRating(activity.providerId)

    return NextResponse.json({ success: true, rating }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al guardar calificacion' }, { status: 500 })
  }
}
