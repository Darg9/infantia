import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSystemStatus } from '@/modules/scraping/alerts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const latest = await prisma.contentQualityMetric.findFirst({
      orderBy: { createdAt: "desc" }
    });

    if (!latest) {
      return NextResponse.json({
        status: "healthy",
        discardRate: 0,
        avgLength: 0
      });
    }

    const discardRate = Math.min(1, latest.pctShort / 100);

    const status = getSystemStatus({
      discardRate,
      avgLength: latest.avgLength
    });

    return NextResponse.json({
      status,
      discardRate,
      avgLength: latest.avgLength
    });
  } catch (error) {
    console.error('Error fetching quality alerts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
