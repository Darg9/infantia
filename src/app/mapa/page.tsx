// =============================================================================
// /mapa — Mapa interactivo de actividades en Bogotá
// =============================================================================

import type { Metadata } from 'next'
import { SITE_URL } from '@/config/site'
import MapClient from './MapClient'

export const metadata: Metadata = {
  title: 'Mapa de actividades en Bogotá | HabitaPlan',
  description: 'Explora actividades para niños y familias en el mapa de Bogotá.',
  alternates: { canonical: `${SITE_URL}/mapa` },
  openGraph: {
    title: 'Mapa de actividades | HabitaPlan',
    description: 'Encuentra actividades cerca de ti en Bogotá.',
    url: `${SITE_URL}/mapa`,
  },
}


async function getMapPoints() {
  // Llamada directa al endpoint (server → server es más eficiente que fetch a sí mismo)
  const { prisma } = await import('@/lib/db')

  const activities = await prisma.activity.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      price: true,
      categories: { select: { category: { select: { name: true, slug: true } } }, take: 1 },
      provider: { select: { name: true, website: true } },
      location: {
        select: {
          latitude: true,
          longitude: true,
          name: true,
          neighborhood: true,
        },
      },
    },
  })

  // Coordenadas base por hostname de proveedor (MVP — sin geocoding real)
  const PROVIDER_COORDS: Record<string, [number, number]> = {
    'idartes.gov.co':                   [4.6297, -74.0817],
    'biblored.gov.co':                  [4.6603, -74.0928],
    'bogota.gov.co':                    [4.5981, -74.0761],
    'culturarecreacionydeporte.gov.co': [4.6351, -74.0747],
    'instagram.com':                    [4.6500, -74.0600],
  }
  const DEFAULT: [number, number] = [4.7110, -74.0721]

  function jitter(id: string): [number, number] {
    const h1 = id.charCodeAt(0) + id.charCodeAt(1) + id.charCodeAt(2)
    const h2 = id.charCodeAt(3) + id.charCodeAt(4) + id.charCodeAt(5)
    return [((h1 % 100) - 50) * 0.0008, ((h2 % 100) - 50) * 0.0008]
  }

  return activities.map((act) => {
    const hasReal = act.location?.latitude != null &&
      Number(act.location.latitude) !== 0

    let lat: number, lng: number
    if (hasReal) {
      lat = Number(act.location!.latitude)
      lng = Number(act.location!.longitude)
    } else {
      let base = DEFAULT
      if (act.provider?.website) {
        try {
          const host = new URL(act.provider.website).hostname.replace('www.', '')
          const key = Object.keys(PROVIDER_COORDS).find((k) => host.includes(k))
          if (key) base = PROVIDER_COORDS[key]
        } catch { /* noop */ }
      }
      const [dLat, dLng] = jitter(act.id)
      lat = base[0] + dLat
      lng = base[1] + dLng
    }

    const priceNum = act.price !== null ? Number(act.price) : null
    const priceLabel =
      priceNum === null ? null
        : priceNum === 0 ? 'Gratis'
        : `$${priceNum.toLocaleString('es-CO')}`

    return {
      id: act.id,
      title: act.title,
      imageUrl: act.imageUrl,
      priceLabel,
      category: act.categories[0]?.category.name ?? null,
      provider: act.provider?.name ?? null,
      lat,
      lng,
    }
  })
}

export default async function MapaPage() {
  const points = await getMapPoints()

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mapa de actividades</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {points.length} actividades en Bogotá · Haz clic en un pin para ver detalles
            </p>
          </div>
          <a
            href="/actividades"
            className="shrink-0 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            ← Ver listado
          </a>
        </div>
      </div>

      {/* Mapa */}
      <div className="p-4">
        <div className="mx-auto max-w-7xl" style={{ height: '580px' }}>
          <MapClient points={points} />
        </div>
      </div>

      {/* Nota coordenadas */}
      <p className="text-center text-xs text-gray-400 pb-3 px-4">
        Las posiciones son aproximadas. Las coordenadas exactas se añadirán con geocoding.
      </p>
    </div>
  )
}
