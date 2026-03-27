// =============================================================================
// POST /api/push/subscribe  — guardar suscripción push del usuario
// DELETE /api/push/subscribe — eliminar suscripción push
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { endpoint, keys } = body as {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Datos de suscripción inválidos' }, { status: 400 })
  }

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

  const body = await req.json()
  const { endpoint } = body as { endpoint: string }
  if (!endpoint) return NextResponse.json({ error: 'endpoint requerido' }, { status: 400 })

  await prisma.pushSubscription.deleteMany({ where: { endpoint } })
  return NextResponse.json({ ok: true })
}
