import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '../../../generated/prisma/client';
import { prisma } from '../../../lib/db';
import { checkRateLimit, getIP, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

const eventSchema = z.object({
  type:       z.string().min(1).max(64),
  activityId: z.string().uuid().optional().nullable(),
  path:       z.string().max(512).optional().nullable(),
  // Json? en Prisma acepta cualquier objeto serializable — validamos como Record<string, unknown>
  metadata:   z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function POST(req: NextRequest) {
  // Rate limiting — 120 req/min por IP (tracking de alta frecuencia)
  const rl = await checkRateLimit(getIP(req), RATE_LIMITS.events);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('Cuerpo inválido', { status: 400 });
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.issues[0]?.message ?? 'Datos inválidos', { status: 400 });
  }

  const { type, activityId, path, metadata } = parsed.data;

  const userAgent = req.headers.get('user-agent') || '';
  const ip        = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null;

  try {
    await prisma.event.create({
      data: {
        type,
        activityId: activityId ?? null,
        path:       path       ?? null,
        // metadata es Json? — Prisma.JsonNull para null explícito, undefined para omitir
        metadata:   metadata != null ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        userAgent,
        ip,
      },
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Tracking Error:', error);
    return new Response(null, { status: 500 });
  }
}
