// =============================================================================
// HabitaPlan - Lógica de expiración de actividades
//
// Reglas:
//   ONE_TIME / CAMP / WORKSHOP con endDate pasado → EXPIRED
//   ONE_TIME / CAMP / WORKSHOP con startDate pasado (sin endDate) → EXPIRED
//     tras N horas, donde N se resuelve por prioridad:
//       1. Location.expirationHoursAfterStart  (más específico — por lugar)
//       2. ScrapingSource.config.expirationHoursAfterStart  (por fuente)
//       3. DEFAULT_EXPIRATION_HOURS (3 horas)
//   RECURRING → no expiran automáticamente
//   Sin ninguna fecha → no expiran automáticamente
// =============================================================================

import { prisma } from '@/lib/db'
import type { Prisma } from '@/generated/prisma/client'

export const DEFAULT_EXPIRATION_HOURS = 3

export interface ExpireResult {
  expired: number
  ids: string[]
}

export async function expireActivities(): Promise<ExpireResult> {
  const now = new Date()

  const expirableTypes: Prisma.EnumActivityTypeFilter['in'] = ['ONE_TIME', 'CAMP', 'WORKSHOP']

  // Candidatas: ACTIVE + tipo expirable + endDate pasado o startDate sin endDate
  const candidates = await prisma.activity.findMany({
    where: {
      status: 'ACTIVE',
      type: { in: expirableTypes },
      OR: [
        { endDate: { lt: now } },
        { startDate: { not: null }, endDate: null },
      ],
    },
    select: {
      id: true,
      title: true,
      type: true,
      startDate: true,
      endDate: true,
      sourcePlatform: true,
      location: {
        select: {
          expirationHoursAfterStart: true,
          cityId: true,
        },
      },
    },
  })

  if (candidates.length === 0) return { expired: 0, ids: [] }

  // Cargar configuraciones de fuentes para resolver horas por fuente
  // (lookup indirecto: sourcePlatform + cityId → ScrapingSource.config)
  const sources = await prisma.scrapingSource.findMany({
    select: { platform: true, cityId: true, config: true },
  })

  const sourceHoursMap = new Map<string, number>()
  for (const src of sources) {
    const cfg = src.config as Record<string, unknown> | null
    const hours = cfg?.expirationHoursAfterStart
    if (typeof hours === 'number') {
      sourceHoursMap.set(`${src.platform}:${src.cityId}`, hours)
    }
  }

  // Determinar qué actividades deben expirar
  const toExpire: string[] = []

  for (const act of candidates) {
    // Caso 1: tiene endDate y ya pasó → siempre expira
    if (act.endDate && act.endDate < now) {
      toExpire.push(act.id)
      continue
    }

    // Caso 2: tiene startDate pero no endDate → calcular según horas configuradas
    if (act.startDate && !act.endDate) {
      const hours = resolveExpirationHours(act, sourceHoursMap)
      const expiresAt = new Date(act.startDate.getTime() + hours * 60 * 60 * 1000)
      if (expiresAt <= now) {
        toExpire.push(act.id)
      }
    }
  }

  if (toExpire.length === 0) return { expired: 0, ids: [] }

  await prisma.activity.updateMany({
    where: { id: { in: toExpire } },
    data: { status: 'EXPIRED' },
  })

  return { expired: toExpire.length, ids: toExpire }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type CandidateActivity = {
  sourcePlatform: string | null
  location: { expirationHoursAfterStart: number | null; cityId: string } | null
}

function resolveExpirationHours(
  act: CandidateActivity,
  sourceHoursMap: Map<string, number>,
): number {
  // Prioridad 1: configuración por lugar
  if (act.location?.expirationHoursAfterStart != null) {
    return act.location.expirationHoursAfterStart
  }

  // Prioridad 2: configuración por fuente (platform + ciudad)
  if (act.sourcePlatform && act.location?.cityId) {
    const srcHours = sourceHoursMap.get(`${act.sourcePlatform}:${act.location.cityId}`)
    if (srcHours != null) return srcHours
  }

  // Prioridad 3: default
  return DEFAULT_EXPIRATION_HOURS
}
