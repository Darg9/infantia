// =============================================================================
// GET /api/profile/notifications — obtiene preferencias de notificacion
// PUT /api/profile/notifications — actualiza preferencias de notificacion
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
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
  try {
    const user = await requireAuth()

    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      select: { notificationPrefs: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const prefs = { ...DEFAULT_PREFS, ...(dbUser.notificationPrefs as Partial<NotificationPrefs>) }
    return NextResponse.json({ prefs })
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()

    // Validate
    const { email, push, frequency, categories } = body
    if (typeof email !== 'boolean' || typeof push !== 'boolean') {
      return NextResponse.json({ error: 'email y push deben ser booleanos' }, { status: 400 })
    }
    if (!['daily', 'weekly', 'none'].includes(frequency)) {
      return NextResponse.json({ error: 'frequency debe ser daily, weekly o none' }, { status: 400 })
    }
    if (categories && typeof categories !== 'object') {
      return NextResponse.json({ error: 'categories debe ser un objeto' }, { status: 400 })
    }

    const prefs: NotificationPrefs = {
      email,
      push,
      frequency,
      categories: {
        newActivities: categories?.newActivities ?? true,
        favoritesUpdates: categories?.favoritesUpdates ?? true,
        providerAnnouncements: categories?.providerAnnouncements ?? false,
      },
    }

    await prisma.user.update({
      where: { supabaseAuthId: user.id },
      data: { notificationPrefs: JSON.parse(JSON.stringify(prefs)) },
    })

    return NextResponse.json({ success: true, prefs })
  } catch {
    return NextResponse.json({ error: 'Error al actualizar preferencias' }, { status: 500 })
  }
}
