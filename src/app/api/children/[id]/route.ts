import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
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

    const child = await prisma.child.findFirst({
      where: { id, userId: dbUser.id },
    })

    if (!child) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const body = await req.json()
    const { name, birthDate, gender } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: 'El nombre no puede superar 100 caracteres' }, { status: 400 })
    }
    if (!birthDate) {
      return NextResponse.json({ error: 'La fecha de nacimiento es obligatoria' }, { status: 400 })
    }

    const birth = new Date(birthDate)
    if (isNaN(birth.getTime())) {
      return NextResponse.json({ error: 'Fecha de nacimiento inválida' }, { status: 400 })
    }

    const today = new Date()
    const eighteenYearsAgo = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
    if (birth < eighteenYearsAgo) {
      return NextResponse.json({ error: 'Solo se permiten perfiles de menores de edad' }, { status: 400 })
    }

    const updated = await prisma.child.update({
      where: { id },
      data: {
        name: name.trim(),
        birthDate: birth,
        gender: gender || null,
      },
    })

    return NextResponse.json({ child: updated })
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
}

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
