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
  } catch {
    // No propagamos errores — tracking nunca debe romper la experiencia
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
