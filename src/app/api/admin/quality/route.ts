import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const source = searchParams.get('source');

    const where: any = {};

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    if (source) {
      where.source = source;
    }

    const data = await prisma.contentQualityMetric.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 500,
      select: {
        createdAt: true,
        avgLength: true,
        pctShort: true,
        pctNoise: true,
        pctPromo: true,
        totalProcessed: true,
        source: true,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching quality metrics:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
