import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UserRole } from '@/generated/prisma/client';
import { z } from 'zod';

const PatchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  tagline: z.string().min(1).max(500).optional(),
  logoUrl: z.string().url().optional().nullable(),
  url: z.string().url().optional(),
  isActive: z.boolean().optional(),
  campaignStart: z.string().datetime().optional().nullable(),
  campaignEnd: z.string().datetime().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole([UserRole.ADMIN]);
    const { id } = await params;
    const body = await req.json();
    const data = PatchSchema.parse(body);

    const sponsor = await prisma.sponsor.update({
      where: { id },
      data: {
        ...data,
        campaignStart: data.campaignStart !== undefined
          ? (data.campaignStart ? new Date(data.campaignStart) : null)
          : undefined,
        campaignEnd: data.campaignEnd !== undefined
          ? (data.campaignEnd ? new Date(data.campaignEnd) : null)
          : undefined,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json(sponsor);
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ error: e.errors }, { status: 400 });
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole([UserRole.ADMIN]);
    const { id } = await params;
    await prisma.sponsor.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
}
