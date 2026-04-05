// PATCH /api/profile/onboarding — Guarda ciudad y marca onboarding como completado
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const Schema = z.object({
  cityId: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const authUser = await getSession();
  if (!authUser) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  await prisma.user.update({
    where: { supabaseAuthId: authUser.id },
    data: {
      onboardingDone: true,
      ...(parsed.data.cityId ? { cityId: parsed.data.cityId } : {}),
    },
  });

  return NextResponse.json({ success: true });
}
