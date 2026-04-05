// GET /api/profile/me — Perfil básico del usuario autenticado
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const authUser = await getSession();
  if (!authUser) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { supabaseAuthId: authUser.id },
    select: { id: true, name: true, cityId: true, onboardingDone: true },
  });

  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  return NextResponse.json(user);
}
