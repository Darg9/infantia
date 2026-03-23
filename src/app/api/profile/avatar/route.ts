// =============================================================================
// POST /api/profile/avatar — sube avatar del usuario a Supabase Storage
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()

    const formData = await req.formData()
    const file = formData.get('avatar') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Formato no soportado. Usa JPG, PNG, WebP o GIF.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'El archivo es demasiado grande. Maximo 2MB.' },
        { status: 400 }
      )
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      select: { id: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Upload to Supabase Storage
    const supabase = await createSupabaseServerClient()
    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
    const path = `${dbUser.id}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: 'Error al subir imagen: ' + uploadError.message },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(path)

    const avatarUrl = urlData.publicUrl

    // Update DB
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { avatarUrl },
    })

    // Update Supabase Auth metadata
    await supabase.auth.updateUser({
      data: { avatar_url: avatarUrl },
    })

    return NextResponse.json({ success: true, avatarUrl })
  } catch {
    return NextResponse.json({ error: 'Error al subir avatar' }, { status: 500 })
  }
}
