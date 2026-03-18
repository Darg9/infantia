import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      select: { id: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Verificar que el hijo pertenece al usuario
    const child = await prisma.child.findFirst({
      where: { id, userId: dbUser.id },
    })

    if (!child) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    await prisma.child.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
}
