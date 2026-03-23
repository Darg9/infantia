// =============================================================================
// PUT /api/profile — actualiza nombre del usuario
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth()

    const body = await req.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
    }

    const trimmedName = name.trim()
    if (trimmedName.length > 100) {
      return NextResponse.json({ error: 'Nombre demasiado largo (max 100 caracteres)' }, { status: 400 })
    }

    // Update local DB first
    await prisma.user.update({
      where: { supabaseAuthId: user.id },
      data: { name: trimmedName },
    })

    // Update Supabase Auth metadata
    const supabase = await createSupabaseServerClient()
    await supabase.auth.updateUser({
      data: { name: trimmedName },
    })

    return NextResponse.json({ success: true, name: trimmedName })
  } catch {
    return NextResponse.json({ error: 'Error al actualizar perfil' }, { status: 500 })
  }
}
