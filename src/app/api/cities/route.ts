// GET /api/cities — Lista de ciudades disponibles
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const cities = await prisma.city.findMany({
    select: { id: true, name: true, countryName: true },
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(cities);
}
