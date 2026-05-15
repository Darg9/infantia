// =============================================================================
// GET /api/admin/categories — Lista todas las categorías (solo ADMIN)
// Usado por el panel admin para filtros y selectores de categoría.
// =============================================================================

import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { UserRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN])
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  })

  return NextResponse.json({ categories })
}
