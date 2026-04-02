// =============================================================================
// POST /api/providers/[slug]/claim — Enviar solicitud de reclamación de perfil
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession, getOrCreateDbUser } from '@/lib/auth';
import { sendClaimNotification } from '@/lib/email/resend';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:providers:claim');

const ClaimSchema = z.object({
  userName: z.string().max(255).optional(),
  message:  z.string().max(1000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const authUser = await getSession();
  if (!authUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { slug } = await params;

  const provider = await prisma.provider.findUnique({ where: { slug } });
  if (!provider) {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
  }
  if (provider.isClaimed) {
    return NextResponse.json({ error: 'Este perfil ya fue reclamado' }, { status: 409 });
  }

  // Verificar que no exista una solicitud PENDING del mismo usuario
  const existing = await prisma.providerClaim.findFirst({
    where: { providerId: provider.id, userId: authUser.id, status: 'PENDING' },
  });
  if (existing) {
    return NextResponse.json({ error: 'Ya tienes una solicitud pendiente para este perfil' }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = ClaimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const dbUser = await getOrCreateDbUser(authUser);

  const claim = await prisma.providerClaim.create({
    data: {
      providerId: provider.id,
      userId:     authUser.id,
      userEmail:  authUser.email ?? '',
      userName:   parsed.data.userName ?? dbUser.name ?? undefined,
      message:    parsed.data.message ?? undefined,
    },
  });

  log.info('Claim creado', { claimId: claim.id, providerSlug: slug, userId: authUser.id });

  // Email al admin — fire & forget
  sendClaimNotification({
    claimId:       claim.id,
    claimantName:  claim.userName ?? claim.userEmail,
    claimantEmail: claim.userEmail,
    providerName:  provider.name,
    providerSlug:  slug,
    message:       claim.message ?? undefined,
  }).catch((err) => log.error('Error enviando claim notification', { error: err.message }));

  return NextResponse.json({ id: claim.id }, { status: 201 });
}
