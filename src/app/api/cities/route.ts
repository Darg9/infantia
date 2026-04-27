// GET /api/cities — Lista de ciudades con al menos 1 actividad activa
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const cities = await prisma.city.findMany({
    select: { id: true, name: true, countryName: true },
    where: {
      isActive: true,
      locations: { some: { activities: { some: { status: 'ACTIVE' } } } },
    },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(cities);
}
