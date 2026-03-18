// =============================================================================
// DELETE /api/favorites/[activityId] — elimina una actividad de favoritos
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
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

    // Verificar que el favorito existe antes de borrar
    const existing = await prisma.favorite.findUnique({
      where: { userId_activityId: { userId: dbUser.id, activityId } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Favorito no encontrado' }, { status: 404 })
    }

    await prisma.favorite.delete({
      where: { userId_activityId: { userId: dbUser.id, activityId } },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
}
