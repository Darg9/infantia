// =============================================================================
// HabitaPlan - Lógica de expiración de actividades
// Reglas:
//   ONE_TIME / CAMP / WORKSHOP con endDate pasado → EXPIRED
//   ONE_TIME / CAMP / WORKSHOP con startDate pasado (>3 días), sin endDate → EXPIRED
//   RECURRING → no expiran automáticamente
//   Sin ninguna fecha → no expiran automáticamente
// =============================================================================

import { prisma } from '@/lib/db'
import type { Prisma } from '@/generated/prisma/client'

export interface ExpireResult {
  expired: number
  ids: string[]
}

export async function expireActivities(): Promise<ExpireResult> {
  const now = new Date()
  // Margen de 3 días para ONE_TIME sin endDate
  const threeDaysAgo = new Date(now)
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  // Candidatas: solo tipos que pueden expirar automáticamente
  const expirableTypes: Prisma.EnumActivityTypeFilter['in'] = ['ONE_TIME', 'CAMP', 'WORKSHOP']

  // Condición 1: tiene endDate y ya pasó
  // Condición 2: tiene startDate (hace >3 días) y no tiene endDate
  const candidates = await prisma.activity.findMany({
    where: {
      status: 'ACTIVE',
      type: { in: expirableTypes },
      OR: [
        { endDate: { lt: now } },
        {
          startDate: { lt: threeDaysAgo },
          endDate: null,
        },
      ],
    },
    select: { id: true, title: true, type: true, startDate: true, endDate: true },
  })

  if (candidates.length === 0) {
    return { expired: 0, ids: [] }
  }

  const ids = candidates.map((a) => a.id)

  await prisma.activity.updateMany({
    where: { id: { in: ids } },
    data: { status: 'EXPIRED' },
  })

  return { expired: ids.length, ids }
}
