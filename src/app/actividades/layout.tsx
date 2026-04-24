// =============================================================================
// /actividades — Layout de segmento
// Monta CityProvider con scope limitado a /actividades y sus sub-rutas.
// Queries en server-side: lista de ciudades + ciudad por defecto (más locations).
// Suspense requerido: CityProvider usa useSearchParams() internamente.
// =============================================================================

import { Suspense } from 'react';
import { CityProvider } from '@/components/providers/CityProvider';
import { prisma } from '@/lib/db';

export default async function ActividadesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cities, defaultCity] = await Promise.all([
    // Lista completa de ciudades activas para el selector
    prisma.city.findMany({
      where: { isActive: true },
      select: {
        id:          true,
        name:        true,
        defaultLat:  true,
        defaultLng:  true,
        defaultZoom: true,
      },
      orderBy: { name: 'asc' },
    }),
    // Ciudad con más locations → default razonable sin hardcodear
    prisma.city.findFirst({
      where: { isActive: true },
      select: { id: true },
      orderBy: { locations: { _count: 'desc' } },
    }),
  ]);

  // Defensivo: si DB vacía, Provider no crashea
  const defaultCityId = defaultCity?.id ?? cities[0]?.id ?? '';

  // Prisma retorna Decimal para lat/lng — serializar a number para CityOption
  const cityOptions = cities.map((c) => ({
    id:          c.id,
    name:        c.name,
    defaultLat:  Number(c.defaultLat),
    defaultLng:  Number(c.defaultLng),
    defaultZoom: c.defaultZoom,
  }));

  return (
    <Suspense>
      <CityProvider defaultCityId={defaultCityId} cities={cityOptions}>
        {children}
      </CityProvider>
    </Suspense>
  );
}
