// =============================================================================
// GET /api/activities/map
// Retorna actividades con coordenadas para el mapa.
// Estrategia MVP: coordenadas base por proveedor + jitter determinista por ID
// (no requiere migración de BD; se mejora cuando se tenga geocoding real)
// =============================================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Coordenadas de referencia por hostname de proveedor
// (centros aproximados de los venues de cada institución en Bogotá)
const PROVIDER_COORDS: Record<string, [number, number]> = {
  'idartes.gov.co':                       [4.6297, -74.0817], // Teatro Mayor Julio Mario
  'biblored.gov.co':                      [4.6603, -74.0928], // Biblioteca Virgilio Barco
  'bogota.gov.co':                        [4.5981, -74.0761], // Plaza Bolívar área
  'culturarecreacionydeporte.gov.co':     [4.6351, -74.0747], // Parque El Tunal
  'instagram.com':                        [4.6500, -74.0600], // Candelaria
};

const DEFAULT_BOGOTA: [number, number] = [4.7110, -74.0721]; // Bogotá centro

// Jitter determinista basado en los primeros chars del ID (reproducible)
function deterministicJitter(id: string): [number, number] {
  const h1 = id.charCodeAt(0) + id.charCodeAt(1) + id.charCodeAt(2);
  const h2 = id.charCodeAt(3) + id.charCodeAt(4) + id.charCodeAt(5);
  const lat = ((h1 % 100) - 50) * 0.0008; // ±0.04° (~4.4 km máx)
  const lng = ((h2 % 100) - 50) * 0.0008;
  return [lat, lng];
}

function getCoords(activity: {
  id: string;
  provider: { website: string | null } | null;
}): [number, number] {
  let base: [number, number] = DEFAULT_BOGOTA;

  if (activity.provider?.website) {
    try {
      const hostname = new URL(activity.provider.website).hostname.replace('www.', '');
      // Match parcial: culturarecreacionydeporte.gov.co, idartes.gov.co, etc.
      const key = Object.keys(PROVIDER_COORDS).find((k) => hostname.includes(k));
      if (key) base = PROVIDER_COORDS[key];
    } catch { /* ignore */ }
  }

  const [dLat, dLng] = deterministicJitter(activity.id);
  return [base[0] + dLat, base[1] + dLng];
}

export async function GET() {
  try {
    const activities = await prisma.activity.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        price: true,
        pricePeriod: true,
        audience: true,
        categories: { select: { category: { select: { name: true, slug: true } } }, take: 1 },
        provider: { select: { name: true, website: true } },
        location: {
          select: {
            latitude: true,
            longitude: true,
            name: true,
            neighborhood: true,
            city: { select: { name: true } },
          },
        },
      },
    });

    const points = activities.map((act) => {
      // Usar coordenadas reales si existen, si no → coordenadas estimadas
      const hasReal = act.location?.latitude != null &&
        Number(act.location.latitude) !== 0 &&
        Number(act.location.longitude) !== 0;

      const [lat, lng] = hasReal
        ? [Number(act.location!.latitude), Number(act.location!.longitude)]
        : getCoords(act);

      const priceLabel =
        act.price === null ? null
          : Number(act.price) === 0 ? 'Gratis'
          : `$${Number(act.price).toLocaleString('es-CO')}`;

      return {
        id: act.id,
        title: act.title,
        imageUrl: act.imageUrl,
        priceLabel,
        category: act.categories[0]?.category.name ?? null,
        provider: act.provider?.name ?? null,
        location: act.location?.name ?? null,
        neighborhood: act.location?.neighborhood ?? null,
        lat,
        lng,
      };
    });

    return NextResponse.json({ points });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
