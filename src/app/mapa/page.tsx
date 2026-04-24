// =============================================================================
// /mapa — Mapa interactivo multi-ciudad
// cityId viene de searchParams (URL canónica) — nunca hardcoded.
// Actividades sin coordenadas reales (lat/lng = 0) son excluidas por diseño.
// =============================================================================

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SITE_URL } from '@/config/site'
import { prisma } from '@/lib/db'
import { CityProvider } from '@/components/providers/CityProvider'
import MapPageClient from './MapPageClient'

export const metadata: Metadata = {
  title: 'Mapa de actividades | HabitaPlan',
  description: 'Explora actividades para niños y familias en el mapa interactivo.',
  alternates: { canonical: `${SITE_URL}/mapa` },
  openGraph: {
    title: 'Mapa de actividades | HabitaPlan',
    description: 'Encuentra actividades cerca de ti.',
    url: `${SITE_URL}/mapa`,
  },
}

type PageProps = {
  searchParams: Promise<{ cityId?: string }>
}

export default async function MapaPage({ searchParams }: PageProps) {
  const params = await searchParams

  // ── Cargar ciudades disponibles (para CityProvider y selector) ─────────────
  const cities = await prisma.city.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      defaultLat: true,
      defaultLng: true,
      defaultZoom: true,
    },
    orderBy: { name: 'asc' },
  })

  // Ciudad por defecto: la primera con más ubicaciones activas (Bogotá en práctica)
  const defaultCity = await prisma.city.findFirst({
    where: { isActive: true },
    orderBy: { locations: { _count: 'desc' } },
    select: { id: true },
  })
  const defaultCityId = defaultCity?.id ?? cities[0]?.id ?? ''

  // Ciudad activa: searchParams primero (URL canónica), luego default
  const activeCityId = params.cityId ?? defaultCityId

  // ── Query estricto: solo actividades con coords reales de la ciudad ────────
  // Las actividades sin lat/lng son excluidas del mapa por diseño (no del listado).
  const activities = await prisma.activity.findMany({
    where: {
      status: 'ACTIVE',
      location: {
        cityId: activeCityId,
        latitude: { not: 0 },
        longitude: { not: 0 },
      },
    },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      price: true,
      categories: {
        select: { category: { select: { name: true } } },
        take: 1,
      },
      provider: { select: { name: true } },
      location: {
        select: {
          latitude: true,
          longitude: true,
          name: true,
          neighborhood: true,
        },
      },
    },
    orderBy: { sourceConfidence: 'desc' },
    take: 500,
  })

  // Serializar para el cliente
  const points = activities
    .filter((a) => a.location)
    .map((a) => ({
      id: a.id,
      title: a.title,
      imageUrl: a.imageUrl,
      priceLabel:
        a.price === null
          ? null
          : Number(a.price) === 0
          ? 'Gratis'
          : `$${Number(a.price).toLocaleString('es-CO')}`,
      category: a.categories[0]?.category.name ?? null,
      provider: a.provider?.name ?? null,
      lat: Number(a.location!.latitude),
      lng: Number(a.location!.longitude),
    }))

  const cityOptions = cities.map((c) => ({
    id: c.id,
    name: c.name,
    defaultLat: Number(c.defaultLat),
    defaultLng: Number(c.defaultLng),
    defaultZoom: c.defaultZoom,
  }))

  const activeCity = cityOptions.find((c) => c.id === activeCityId)

  return (
    <Suspense>
      <CityProvider defaultCityId={defaultCityId} cities={cityOptions}>
        <MapPageClient
          points={points}
          activeCity={activeCity}
          totalCount={points.length}
        />
      </CityProvider>
    </Suspense>
  )
}
