import { getErrorMessage } from '../../../../../lib/error';
// =============================================================================
// PATCH /api/admin/claims/[id] — Aprobar o rechazar una solicitud (admin)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { UserRole } from '@/generated/prisma/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:claims');

const ActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
});

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireRole([UserRole.ADMIN]);

  const { id } = await params;

  const claim = await prisma.providerClaim.findUnique({
    where: { id },
    include: { provider: true },
  });

  if (!claim) {
    return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
  }
  if (claim.status !== 'PENDING') {
    return NextResponse.json({ error: 'La solicitud ya fue procesada' }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
  }

  if (parsed.data.action === 'reject') {
    const updated = await prisma.providerClaim.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
    return NextResponse.json(updated);
  }

  // ── Aprobar ──────────────────────────────────────────────────────────────
  await prisma.$transaction([
    prisma.providerClaim.update({ where: { id }, data: { status: 'APPROVED' } }),
    prisma.provider.update({ where: { id: claim.providerId }, data: { isClaimed: true } }),
    prisma.user.updateMany({
      where: { supabaseAuthId: claim.userId },
      data:  { role: 'PROVIDER' },
    }),
  ]);

  // Actualizar app_metadata en Supabase Auth
  try {
    const supabaseAdmin = getSupabaseAdmin();
    await supabaseAdmin.auth.admin.updateUserById(claim.userId, {
      app_metadata: { role: 'provider' },
    });
    log.info('app_metadata actualizado a provider', { userId: claim.userId });
  } catch (err: unknown) {
    log.error('Error actualizando app_metadata', { userId: claim.userId, error: getErrorMessage(err) });
    // No bloqueamos la respuesta — la BD ya está actualizada
  }

  log.info('Claim aprobado', { claimId: id, providerId: claim.providerId, userId: claim.userId });
  return NextResponse.json({ status: 'APPROVED' });
}
