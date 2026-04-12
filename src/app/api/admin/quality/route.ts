import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await prisma.contentQualityMetric.findMany({
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        createdAt: true,
        avgLength: true,
        pctShort: true,
        pctNoise: true,
        pctPromo: true,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching quality metrics:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
