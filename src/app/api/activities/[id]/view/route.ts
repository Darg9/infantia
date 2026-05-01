import { getErrorMessage } from '../../../../../lib/error';
// =============================================================================
// POST /api/activities/[id]/view
// Registra una visita anónima a una actividad (para métricas).
// Fire-and-forget desde el cliente — nunca bloquea el render.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    await prisma.activityView.create({
      data: { activityId: id },
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('VIEW TRACKER ERROR:', err)
    return NextResponse.json({ ok: false, details: getErrorMessage(err) || String(err) }, { status: 500 });
  }
}
