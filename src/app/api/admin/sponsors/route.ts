import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UserRole } from '@/generated/prisma/client';
import { z } from 'zod';

const SponsorSchema = z.object({
  name: z.string().min(1).max(255),
  tagline: z.string().min(1).max(500),
  logoUrl: z.string().url().optional().nullable(),
  url: z.string().url(),
  isActive: z.boolean().optional(),
  campaignStart: z.string().datetime().optional().nullable(),
  campaignEnd: z.string().datetime().optional().nullable(),
});

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN]);
    const sponsors = await prisma.sponsor.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(sponsors);
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole([UserRole.ADMIN]);
    const body = await req.json();
    const data = SponsorSchema.parse(body);
    const sponsor = await prisma.sponsor.create({
      data: {
        ...data,
        campaignStart: data.campaignStart ? new Date(data.campaignStart) : null,
        campaignEnd: data.campaignEnd ? new Date(data.campaignEnd) : null,
      },
    });
    return NextResponse.json(sponsor, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues }, { status: 400 });
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
}
