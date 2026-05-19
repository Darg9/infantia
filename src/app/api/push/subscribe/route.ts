// =============================================================================
// POST /api/push/subscribe  — guardar suscripción push del usuario
// DELETE /api/push/subscribe — eliminar suscripción push
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

const subscribeSchema = z.object({
  endpoint: z.string().url('endpoint debe ser una URL válida').max(2048),
  keys: z.object({
    p256dh: z.string().min(1, 'p256dh requerido'),
    auth:   z.string().min(1, 'auth requerido'),
  }),
})

const unsubscribeSchema = z.object({
  endpoint: z.string().min(1, 'endpoint requerido'),
})

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const parsed = subscribeSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json({ error: first?.message ?? 'Datos de suscripción inválidos' }, { status: 400 })
  }

  const { endpoint, keys } = parsed.data

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: session.id },
    select: { id: true },
  })
  if (!dbUser) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  // Upsert por endpoint (mismo navegador puede re-suscribirse)
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: dbUser.id },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: dbUser.id },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const parsed = unsubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'endpoint requerido' }, { status: 400 })
  }

  await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint } })
  return NextResponse.json({ ok: true })
}
