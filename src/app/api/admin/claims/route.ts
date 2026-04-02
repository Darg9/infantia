// =============================================================================
// GET /api/admin/claims — Listar solicitudes de reclamación (admin)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { UserRole } from '@/generated/prisma/client';

export async function GET(req: NextRequest) {
  await requireRole([UserRole.ADMIN]);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as 'PENDING' | 'APPROVED' | 'REJECTED' | null;

  const claims = await prisma.providerClaim.findMany({
    where: status ? { status } : undefined,
    include: {
      provider: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(claims);
}
