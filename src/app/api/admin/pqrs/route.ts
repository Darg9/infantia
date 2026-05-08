import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { UserRole } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

// GET /api/admin/pqrs?status=received|in_progress|closed|all
export async function GET(request: Request) {
  await requireRole([UserRole.ADMIN]);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'all';

  const where = status !== 'all' ? { status } : {};

  const items = await prisma.contactRequest.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    select: {
      id:               true,
      createdAt:        true,
      name:             true,
      email:            true,
      category:         true,
      message:          true,
      dataRightType:    true,
      status:           true,
      statusChangedAt:  true,
      resolvedAt:       true,
      firstRespondedAt: true,
      responseChannel:  true,
      emailStatus:      true,
    },
  });

  return NextResponse.json(items);
}
