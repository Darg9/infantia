// =============================================================================
// GET /api/activities/map
// Devuelve hasta 500 actividades ACTIVE con coordenadas para el mapa.
// Acepta los mismos filtros que /actividades.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';

type PrismaDecimal = number | string | { toNumber?: () => number; valueOf?: () => unknown } | null;

function toNum(v: PrismaDecimal): number {
  if (v === null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof v.toNumber === 'function') {
    const parsed = v.toNumber();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof v.valueOf === 'function') {
    const raw = v.valueOf();
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatPrice(price: PrismaDecimal, currency: string, period: string | null): string {
  if (price === null) return '';
  const n = toNum(price);
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
  const search   = sp.get('search')?.trim()  || undefined;
  const ageMin   = parseInt(sp.get('ageMin') ?? '', 10);
  const ageMax   = parseInt(sp.get('ageMax') ?? '', 10);
  const categoryId = sp.get('categoryId') || undefined;
  const cityId     = sp.get('cityId')     || undefined;
  const type       = sp.get('type')       || undefined;
  const audience   = sp.get('audience')   || undefined;
  const price      = sp.get('price')      || undefined;

  const and: Prisma.ActivityWhereInput[] = [];

  // Solo actividades con coordenadas reales — cityId también va aquí
  // para evitar conflicto con la key "location" en el WHERE raíz
  const locationFilter: Record<string, unknown> = {
    latitude:  { not: 0 },
    longitude: { not: 0 },
  };
  if (cityId) locationFilter.cityId = cityId;
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
        lat:          toNum(r.location!.latitude  as PrismaDecimal),
        lng:          toNum(r.location!.longitude as PrismaDecimal),
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
