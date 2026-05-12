import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { UserRole } from '@/generated/prisma/client';
import { getBusinessDays, classifySla } from '@/lib/pqrs';

export const dynamic = 'force-dynamic';

// GET /api/admin/pqrs?status=all|received|in_progress|closed&category=...&overdue=true&page=1&limit=50
export async function GET(request: Request) {
  await requireRole([UserRole.ADMIN]);

  const { searchParams } = new URL(request.url);
  const status   = searchParams.get('status')   ?? 'all';
  const category = searchParams.get('category') ?? 'all';
  const overdue  = searchParams.get('overdue')  === 'true';
  const page     = Math.max(1, Number(searchParams.get('page')  ?? '1'));
  const limit    = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50')));

  const where: Record<string, unknown> = {};
  if (status   !== 'all') where.status   = status;
  if (category !== 'all') where.category = category;

  const items = await prisma.contactRequest.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    skip: (page - 1) * limit,
    take: limit,
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

  const now = new Date();
  const enriched = items.map((item) => {
    const businessDays = getBusinessDays(item.createdAt, now);
    const { level, limit: slaLimit } = classifySla(businessDays, item.category);
    return { ...item, sla: { businessDays, limit: slaLimit, level } };
  });

  const result = overdue
    ? enriched.filter((i) => i.sla.level !== null)
    : enriched;

  const total = overdue
    ? result.length
    : await prisma.contactRequest.count({ where });

  return NextResponse.json({ items: result, total, page, limit });
}
