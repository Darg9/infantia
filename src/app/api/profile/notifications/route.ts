// =============================================================================
// GET /api/profile/notifications — obtiene preferencias de notificacion
// PUT /api/profile/notifications — actualiza preferencias de notificacion
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

const DEFAULT_PREFS = {
  email: true,
  push: true,
  frequency: 'daily' as const,
  categories: {
    newActivities: true,
    favoritesUpdates: true,
    providerAnnouncements: false,
  },
}

type NotificationPrefs = typeof DEFAULT_PREFS

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    select: { notificationPrefs: true },
  })

  const prefs = { ...DEFAULT_PREFS, ...(dbUser?.notificationPrefs as Partial<NotificationPrefs> | undefined) }
  return NextResponse.json({ prefs })
}

export async function PUT(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { email, push, frequency, categories } = body as Record<string, unknown>

  if (typeof email !== 'boolean' || typeof push !== 'boolean') {
    return NextResponse.json({ error: 'email y push deben ser booleanos' }, { status: 400 })
  }
  if (!['daily', 'weekly', 'none'].includes(frequency as string)) {
    return NextResponse.json({ error: 'frequency debe ser daily, weekly o none' }, { status: 400 })
  }
  if (categories && typeof categories !== 'object') {
    return NextResponse.json({ error: 'categories debe ser un objeto' }, { status: 400 })
  }

  const cat = categories as Record<string, boolean> | undefined
  const prefs: NotificationPrefs = {
    email,
    push,
    frequency: frequency as NotificationPrefs['frequency'],
    categories: {
      newActivities: cat?.newActivities ?? true,
      favoritesUpdates: cat?.favoritesUpdates ?? true,
      providerAnnouncements: cat?.providerAnnouncements ?? false,
    },
  }

  const name =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'Usuario'

  await prisma.user.upsert({
    where: { supabaseAuthId: user.id },
    create: {
      supabaseAuthId: user.id,
      email: user.email ?? '',
      name,
      role: 'PARENT',
      notificationPrefs: JSON.parse(JSON.stringify(prefs)),
    },
    update: { notificationPrefs: JSON.parse(JSON.stringify(prefs)) },
  })

  return NextResponse.json({ success: true, prefs })
}
