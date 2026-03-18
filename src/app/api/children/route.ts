import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Texto exacto de consentimiento — debe coincidir con el mostrado en el formulario
export const CONSENT_TEXT =
  'Soy el padre, madre o tutor legal de este menor y autorizo el tratamiento de sus datos personales ' +
  'por parte de Infantia conforme a la Política de Tratamiento de Datos Personales (Ley 1581 de 2012). ' +
  'Los datos del menor se usarán exclusivamente para personalizar la búsqueda de actividades y nunca serán ' +
  'compartidos con terceros para fines comerciales.'

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

    const children = await prisma.child.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        birthDate: true,
        gender: true,
        interests: true,
        consentGivenAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ children })
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()


    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      select: { id: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const body = await req.json()
    const { name, birthDate, gender, interests, consentAccepted } = body

    if (!name || !birthDate) {
      return NextResponse.json({ error: 'Nombre y fecha de nacimiento son obligatorios' }, { status: 400 })
    }

    if (!consentAccepted) {
      return NextResponse.json({ error: 'Debe aceptar la autorización de tratamiento de datos' }, { status: 400 })
    }

    const birth = new Date(birthDate)
    if (isNaN(birth.getTime())) {
      return NextResponse.json({ error: 'Fecha de nacimiento inválida' }, { status: 400 })
    }

    // Validar que sea menor de edad
    const today = new Date()
    const age = today.getFullYear() - birth.getFullYear()
    if (age > 18) {
      return NextResponse.json({ error: 'Solo se pueden registrar perfiles de menores de edad' }, { status: 400 })
    }

    const child = await prisma.child.create({
      data: {
        userId: dbUser.id,
        name: name.trim(),
        birthDate: birth,
        gender: gender ?? null,
        interests: interests ?? [],
        consentGivenAt: new Date(),
        consentGivenBy: dbUser.id,
        consentType: 'parental',
        consentText: CONSENT_TEXT,
      },
    })

    return NextResponse.json({ child }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear el perfil' }, { status: 500 })
  }
}
