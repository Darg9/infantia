// =============================================================================
// GET /api/activities — List activities with filters
// POST /api/activities — Create activity
// =============================================================================

import { NextRequest } from 'next/server';
import { successResponse, paginatedResponse, errorResponse } from '@/lib/api-response';
import { listActivities, createActivity } from '@/modules/activities';
import { listActivitiesSchema, createActivitySchema } from '@/modules/activities';
import { Prisma } from '@/generated/prisma/client';

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = listActivitiesSchema.safeParse(params);

    if (!parsed.success) {
      return errorResponse('Parámetros inválidos', 400, parsed.error.flatten().fieldErrors);
    }

    const { page, pageSize, ...filters } = parsed.data;
    const skip = (page - 1) * pageSize;
    const { activities, total } = await listActivities({ skip, pageSize, ...filters });

    return paginatedResponse(activities, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('GET /api/activities error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createActivitySchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('Datos inválidos', 400, parsed.error.flatten().fieldErrors);
    }

    const activity = await createActivity(parsed.data);
    return successResponse(activity, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return errorResponse('Referencia inválida: proveedor, ubicación o vertical no existe', 400);
      }
    }
    console.error('POST /api/activities error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
