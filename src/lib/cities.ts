/**
 * getCitiesForSelector — Fuente compartida de ciudades para CitySwitcher
 *
 * Usado por Header y Home para garantizar que ambos selectores muestren
 * exactamente las mismas ciudades con los mismos conteos.
 *
 * Lógica de conteo dual:
 *   strictCount — actividades con location.cityId asignada
 *                 Gate: solo mostramos ciudades donde strictCount ≥ 1.
 *                 Evita ciudades fantasma que solo tienen actividades sin geocodificar.
 *
 *   orCount     — OR(locationId null, location.cityId) = mismo WHERE que /actividades
 *                 Número visible: coincide con lo que verá el usuario en resultados.
 */

import { prisma } from '@/lib/db'
import { buildActivityWhere } from '@/modules/activities/activity-filters'
import type { CityOption } from '@/components/providers/CityProvider'

export async function getCitiesForSelector(): Promise<CityOption[]> {
  const [rawCities, badDomainSources] = await Promise.all([
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true, defaultLat: true, defaultLng: true, defaultZoom: true },
      orderBy: [{ locations: { _count: 'desc' } }, { name: 'asc' }],
    }),
    prisma.sourceHealth.findMany({
      where: { score: { lt: 0.1 } },
      select: { source: true },
    }),
  ])
  const badDomains = badDomainSources.map((h) => h.source)

  const badDomainsFilter =
    badDomains.length > 0
      ? { AND: [{ OR: [{ sourceDomain: null }, { NOT: { sourceDomain: { in: badDomains } } }] }] }
      : {}

  const entries = await Promise.all(
    rawCities.map(async (city) => {
      const [strictCount, orCount] = await Promise.all([
        prisma.activity.count({
          where: {
            status: 'ACTIVE',
            locationId: { not: null },
            location: { cityId: city.id },
            ...badDomainsFilter,
          },
        }),
        prisma.activity.count({
          where: buildActivityWhere({ status: 'ACTIVE', cityId: city.id, badDomains }),
        }),
      ])
      return { city, strictCount, orCount }
    }),
  )

  return entries
    .filter(({ strictCount }) => strictCount > 0)
    .map(({ city, orCount }) => ({
      id:            city.id,
      name:          city.name,
      defaultLat:    Number(city.defaultLat),
      defaultLng:    Number(city.defaultLng),
      defaultZoom:   city.defaultZoom,
      activityCount: orCount,
    }))
}
