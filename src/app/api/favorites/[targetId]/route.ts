// =============================================================================
// DELETE /api/favorites/[activityId] — elimina una actividad de favoritos
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getOrCreateDbUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ targetId: string }> }
) {
  try {
    const user = await requireAuth()
    const { targetId } = await params
    const type = req.nextUrl.searchParams.get('type') || 'activity'

    const dbUser = await getOrCreateDbUser(user)

    if (type === 'activity') {
      const existing = await prisma.favorite.findFirst({
        where: { userId: dbUser.id, activityId: targetId },
      })
      if (!existing) {
        return NextResponse.json({ error: 'Favorito no encontrado' }, { status: 404 })
      }
      await prisma.favorite.deleteMany({
        where: { userId: dbUser.id, activityId: targetId },
      })
    } else if (type === 'place') {
      const existing = await prisma.favorite.findFirst({
        where: { userId: dbUser.id, locationId: targetId },
      })
      if (!existing) {
        return NextResponse.json({ error: 'Favorito no encontrado' }, { status: 404 })
      }
      await prisma.favorite.deleteMany({
        where: { userId: dbUser.id, locationId: targetId },
      })
    } else {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno o no autorizado' }, { status: 500 })
  }
}
