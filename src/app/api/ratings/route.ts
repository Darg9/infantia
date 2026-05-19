// =============================================================================
// GET /api/ratings — lista calificaciones del usuario autenticado
// POST /api/ratings — crea o actualiza una calificacion
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { recalcProviderRating } from '@/lib/ratings'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'

// Mensajes en español que coinciden con lo que retorna la API al cliente.
// Zod v4: usar `error` (string) en el constructor en lugar de invalid_type_error/required_error.
const ratingSchema = z.object({
  activityId: z
    .string({ error: 'activityId requerido' })
    .min(1, 'activityId requerido'),
  score: z
    .number({ error: 'score debe ser un entero entre 1 y 5' })
    .int('score debe ser un entero entre 1 y 5')
    .min(1, 'score debe ser un entero entre 1 y 5')
    .max(5, 'score debe ser un entero entre 1 y 5'),
  comment: z
    .string({ error: 'comment debe ser texto (max 500 caracteres)' })
    .max(500, 'comment debe ser texto (max 500 caracteres)')
    .optional()
    .nullable(),
})

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

    // Rate limiting — 20 req/hora por userId (post-auth, limita abuso de cuentas)
    const rl = await checkRateLimit(dbUser.id, RATE_LIMITS.ratings)
    if (!rl.allowed) return rateLimitResponse(rl)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
    }

    const parsed = ratingSchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return NextResponse.json({ error: first?.message ?? 'Datos inválidos' }, { status: 400 })
    }

    const { activityId, score, comment } = parsed.data

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
