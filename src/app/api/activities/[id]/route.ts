// =============================================================================
// GET /api/activities/[id] — Get activity by ID
// PUT /api/activities/[id] — Update activity (requiere ADMIN)
// DELETE /api/activities/[id] — Soft delete (requiere ADMIN)
// =============================================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { uuidSchema } from '@/lib/validation';
import { getActivityById, updateActivity, deleteActivity } from '@/modules/activities';
import { updateActivitySchema } from '@/modules/activities';
import { Prisma, UserRole } from '@/generated/prisma/client';
import { requireRole } from '@/lib/auth';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) {
      return errorResponse('ID inválido', 400);
    }

    const activity = await getActivityById(id);
    if (!activity) {
      return errorResponse('Actividad no encontrada', 404);
    }

    return successResponse(activity);
  } catch (error) {
    console.error('GET /api/activities/[id] error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole([UserRole.ADMIN]);

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) {
      return errorResponse('ID inválido', 400);
    }

    const body = await request.json();
    const parsed = updateActivitySchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('Datos inválidos', 400, parsed.error.flatten().fieldErrors);
    }

    const activity = await updateActivity(id, parsed.data);
    return successResponse(activity);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') return errorResponse('Actividad no encontrada', 404);
      if (error.code === 'P2003') return errorResponse('Referencia inválida', 400);
    }
    console.error('PUT /api/activities/[id] error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole([UserRole.ADMIN]);

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) {
      return errorResponse('ID inválido', 400);
    }

    await deleteActivity(id);
    return successResponse({ message: 'Actividad eliminada' });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return errorResponse('Actividad no encontrada', 404);
    }
    console.error('DELETE /api/activities/[id] error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
