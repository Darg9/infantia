// =============================================================================
// GET /api/activities/map
// Devuelve hasta 500 actividades ACTIVE con coordenadas para el mapa.
// Acepta los mismos filtros que /actividades.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import { normalizePrice } from '@/lib/decimal';

type PrismaDecimal = number | string | { toNumber?: () => number; valueOf?: () => unknown } | null;

function formatPrice(price: PrismaDecimal, currency: string, period: string | null): string {
  if (price === null) return '';
  const n = normalizePrice(price) ?? 0;
  if (n === 0 || period === 'FREE') return 'Gratis';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency, minimumFractionDigits: 0,
  }).format(n);
}

const VALID_TYPES     = ['ONE_TIME', 'RECURRING', 'WORKSHOP', 'CAMP'];
const VALID_AUDIENCES = ['KIDS', 'FAMILY', 'ADULTS', 'ALL'];

function audienceIn(audience: string): string[] {
  if (audience === 'KIDS')   return ['KIDS', 'ALL'];
  if (audience === 'FAMILY') return ['FAMILY', 'ALL'];
  if (audience === 'ADULTS') return ['ADULTS', 'ALL'];
  return [];
}

export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams;
  const cityId   = sp.get('cityId') || undefined;

  // ─── Contract: cityId es OBLIGATORIO ─────────────────────────────────────
  // El backend no decide la ciudad. Esa responsabilidad es del frontend
  // (URL > CityContext > localStorage). Nunca fallback implícito.
  if (!cityId) {
    return NextResponse.json(
      { error: 'cityId is required. El mapa requiere una ciudad explícita.' },
      { status: 400 }
    );
  }

  const search     = sp.get('search')?.trim()  || undefined;
  const ageMin     = parseInt(sp.get('ageMin') ?? '', 10);
  const ageMax     = parseInt(sp.get('ageMax') ?? '', 10);
  const categoryId = sp.get('categoryId') || undefined;
  const type       = sp.get('type')       || undefined;
  const audience   = sp.get('audience')   || undefined;
  const price      = sp.get('price')      || undefined;

  const and: Prisma.ActivityWhereInput[] = [];

  // Filtro de ubicación: cityId obligatorio + coords válidas (≠ 0)
  // Las 68 actividades sin geocodificación quedan excluidas por diseño.
  const locationFilter: Record<string, unknown> = {
    cityId,
    latitude:  { not: 0 },
    longitude: { not: 0 },
  };
  and.push({ location: locationFilter as Prisma.LocationWhereInput });

  if (search) {
    and.push({
      OR: [
        { title:       { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (Number.isFinite(ageMin)) {
    and.push({ OR: [{ ageMax: { gte: ageMin } }, { ageMax: null }] });
  }
  if (Number.isFinite(ageMax)) {
    and.push({ OR: [{ ageMin: { lte: ageMax } }, { ageMin: null }] });
  }

  if (price === 'free') {
    and.push({ OR: [{ price: 0 }, { pricePeriod: 'FREE' }] });
  } else if (price === 'paid') {
    and.push({
      AND: [
        { price: { not: null } },
        { price: { gt: 0 } },
        { NOT: { pricePeriod: 'FREE' } },
      ],
    });
  }

  if (categoryId) {
    and.push({ categories: { some: { categoryId } } });
  }

  const where: Prisma.ActivityWhereInput = {
    status: 'ACTIVE',
    ...(type && VALID_TYPES.includes(type)
      ? { type: type as Prisma.EnumActivityTypeFilter }
      : {}),
    ...(audience && VALID_AUDIENCES.includes(audience) && audienceIn(audience).length
      ? { audience: { in: audienceIn(audience) } as Prisma.EnumActivityAudienceFilter }
      : {}),
    AND: and,
  };

  try {
    const rows = await prisma.activity.findMany({
      where,
      select: {
        id:            true,
        title:         true,
        price:         true,
        priceCurrency: true,
        pricePeriod:   true,
        location: {
          select: {
            name:         true,
            neighborhood: true,
            latitude:     true,
            longitude:    true,
          },
        },
        categories: {
          select: { category: { select: { name: true } } },
          take: 1,
        },
      },
      orderBy: { sourceConfidence: 'desc' },
      take: 500,
    });

    const markers = rows
      .filter((r) => r.location)
      .map((r) => ({
        id:           r.id,
        title:        r.title,
        lat:          normalizePrice(r.location!.latitude) ?? 0,
        lng:          normalizePrice(r.location!.longitude) ?? 0,
        category:     r.categories[0]?.category.name ?? null,
        locationName: r.location!.neighborhood ?? r.location!.name,
        priceLabel:   formatPrice(r.price as PrismaDecimal, r.priceCurrency, r.pricePeriod),
      }))
      // Excluir (0,0) que queda de actividades sin geocodificar
      .filter((m) => m.lat !== 0 || m.lng !== 0);

    return NextResponse.json({ markers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
