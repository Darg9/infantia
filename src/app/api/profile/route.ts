// =============================================================================
// PUT /api/profile — actualiza nombre del usuario
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function PUT(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { name } = body as Record<string, unknown>

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  }

  const trimmedName = name.trim()
  if (trimmedName.length > 100) {
    return NextResponse.json({ error: 'Nombre demasiado largo (max 100 caracteres)' }, { status: 400 })
  }

  await prisma.user.upsert({
    where: { supabaseAuthId: user.id },
    create: {
      supabaseAuthId: user.id,
      email: user.email ?? '',
      name: trimmedName,
      role: 'PARENT',
    },
    update: { name: trimmedName },
  })

  // Update Supabase Auth metadata
  const supabase = await createSupabaseServerClient()
  await supabase.auth.updateUser({ data: { name: trimmedName } })

  return NextResponse.json({ success: true, name: trimmedName })
}
