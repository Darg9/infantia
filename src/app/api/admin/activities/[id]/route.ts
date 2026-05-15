// =============================================================================
// PATCH /api/admin/activities/[id] — Editar campos clave de una actividad (solo ADMIN)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { UserRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const patchSchema = z.object({
  title: z.string().trim().min(3).max(255).optional(),
  description: z.string().trim().min(10).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'DRAFT', 'EXPIRED']).optional(),
  price: z.number().min(0).nullable().optional(),
  ageMin: z.number().int().min(0).max(120).nullable().optional(),
  ageMax: z.number().int().min(0).max(120).nullable().optional(),
  audience: z.enum(['KIDS', 'FAMILY', 'ADULTS', 'ALL']).optional(),
  /** UUID de la categoría canónica a asignar (reemplaza todas las categorías actuales) */
  categoryId: z.string().uuid().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Se requiere al menos un campo' })

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole([UserRole.ADMIN])
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = patchSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const { categoryId, ...activityData } = parsed.data

    // Actualizar campos de la actividad
    const activity = await prisma.activity.update({
      where: { id },
      data: activityData,
      select: { id: true, title: true, status: true },
    })

    // Si se envía categoryId, reemplazar todas las categorías actuales
    if (categoryId) {
      await prisma.activityCategory.deleteMany({ where: { activityId: id } })
      await prisma.activityCategory.create({
        data: { activityId: id, categoryId },
      })
    }

    return NextResponse.json({ activity })
  } catch {
    return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 })
  }
}
