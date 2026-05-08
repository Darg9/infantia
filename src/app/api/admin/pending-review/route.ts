// =============================================================================
// API: /api/admin/pending-review
// GET  — lista actividades PENDING_REVIEW (paginado, separadas por tipo de fuente)
// PATCH — aprueba o rechaza una actividad por id
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { UserRole } from '@/generated/prisma/client';
import { recordSourceDecision } from '@/modules/scraping/quality/source-trust';

// ── GET /api/admin/pending-review ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  await requireRole([UserRole.ADMIN]);

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = 20;
  const type     = searchParams.get('type'); // 'institutional' | 'other' | null (todos)

  // Dominios institucionales para filtrar
  const { INSTITUTIONAL_DOMAINS } = await import('@/config/institutional-whitelist');
  const institutionalDomains = [...INSTITUTIONAL_DOMAINS];

  const whereBase = { status: 'PENDING_REVIEW' as const };
  const whereInstitutional = {
    ...whereBase,
    sourceDomain: { in: institutionalDomains },
  };
  const whereOther = {
    ...whereBase,
    OR: [
      { sourceDomain: { notIn: institutionalDomains } },
      { sourceDomain: null },
    ],
  };

  const where = type === 'institutional' ? whereInstitutional
              : type === 'other'          ? whereOther
              : whereBase;

  const [activities, totalInstitutional, totalOther] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        categories: { include: { category: true } },
        location:   { include: { city: true } },
        provider:   true,
      },
    }),
    prisma.activity.count({ where: whereInstitutional }),
    prisma.activity.count({ where: whereOther }),
  ]);

  // Enriquecer con review_decision (snapshot gate)
  type ReviewDecisionRow = {
    activity_id: string;
    gate_score: number;
    gate_reason: string;
    gate_signals: Record<string, unknown>;
    source_trust: number;
    is_institutional: boolean;
  };
  const activityIds = activities.map((a) => a.id);
  const snapshots = activityIds.length > 0
    ? await prisma.$queryRawUnsafe<ReviewDecisionRow[]>(
        `SELECT activity_id, gate_score, gate_reason, gate_signals, source_trust, is_institutional
         FROM review_decisions WHERE activity_id = ANY($1::text[]) AND decision IS NULL`,
        activityIds,
      )
    : [];

  const snapshotMap = Object.fromEntries(snapshots.map((s) => [s.activity_id, s]));

  const enriched = activities.map((a) => ({
    id:            a.id,
    title:         a.title,
    description:   a.description?.substring(0, 300),
    status:        a.status,
    sourceDomain:  a.sourceDomain,
    sourceUrl:     a.sourceUrl,
    imageUrl:      a.imageUrl,
    createdAt:     a.createdAt,
    categories:    a.categories.map((ac) => ac.category.name),
    city:          a.location?.city?.name ?? null,
    provider:      a.provider?.name ?? null,
    isInstitutional: institutionalDomains.some(
      (d) => a.sourceDomain === d || a.sourceDomain?.endsWith('.' + d),
    ),
    gate: snapshotMap[a.id] ?? null,
  }));

  // Queue Health — últimas 24h
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  type QueueRow = { entered: string; reviewed: string };
  const [queueRows] = await Promise.all([
    prisma.$queryRawUnsafe<QueueRow[]>(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= $1) AS entered,
         COUNT(*) FILTER (WHERE reviewed_at >= $1 AND decision IS NOT NULL) AS reviewed
       FROM review_decisions`,
      since24h,
    ),
  ]);
  const queueHealth = {
    enteredLast24h:  parseInt(String(queueRows[0]?.entered  ?? 0)),
    reviewedLast24h: parseInt(String(queueRows[0]?.reviewed ?? 0)),
    totalPending:    totalInstitutional + totalOther,
  };

  return NextResponse.json({
    activities: enriched,
    pagination: {
      page,
      pageSize,
      totalInstitutional,
      totalOther,
      total: type === 'institutional' ? totalInstitutional
           : type === 'other'         ? totalOther
           : totalInstitutional + totalOther,
    },
    queueHealth,
  });
}

// ── PATCH /api/admin/pending-review ───────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const adminSession = await requireRole([UserRole.ADMIN]);

  const body = await req.json() as {
    id: string;
    decision: 'approve' | 'reject';
    reason?: string;
  };

  const { id, decision, reason } = body;
  if (!id || !['approve', 'reject'].includes(decision)) {
    return NextResponse.json({ error: 'id y decision (approve|reject) son obligatorios' }, { status: 400 });
  }

  const activity = await prisma.activity.findUnique({
    where: { id },
    select: { id: true, status: true, sourceDomain: true, title: true },
  });

  if (!activity) {
    return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 });
  }
  if (activity.status !== 'PENDING_REVIEW') {
    return NextResponse.json({ error: `La actividad tiene status "${activity.status}", no PENDING_REVIEW` }, { status: 409 });
  }

  const newStatus = decision === 'approve' ? 'ACTIVE' : 'PAUSED';
  const userEmail = adminSession.user?.email ?? 'admin';

  // 1. Actualizar status + marcar como verificada humana si se aprueba
  await prisma.activity.update({
    where: { id },
    data: {
      status:     newStatus as 'ACTIVE' | 'PAUSED',
      isVerified: decision === 'approve', // human_verified = señal fuerte para ranking futuro
    },
  });

  // 2. Registrar decisión en review_decisions
  await prisma.$executeRawUnsafe(
    `UPDATE review_decisions
     SET decision = $1, decision_reason = $2, reviewed_at = now(), reviewed_by = $3
     WHERE activity_id = $4 AND decision IS NULL`,
    decision === 'approve' ? 'approved' : 'rejected',
    reason ?? null,
    userEmail,
    id,
  );

  // 3. Actualizar source_learning (trust score) — fire-and-forget
  if (activity.sourceDomain) {
    void recordSourceDecision(
      activity.sourceDomain,
      decision === 'approve' ? 'approved' : 'rejected',
    );
  }

  return NextResponse.json({
    ok: true,
    id,
    newStatus,
    message: `"${activity.title}" → ${newStatus}`,
  });
}
