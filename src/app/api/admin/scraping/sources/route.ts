// =============================================================================
// GET /api/admin/scraping/sources — List all scraping sources
// =============================================================================

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger';

const log = createLogger('api:scraping:sources');

export async function GET() {
  try {
    const sources = await prisma.scrapingSource.findMany({
      include: {
        city: { select: { name: true, countryCode: true } },
        vertical: { select: { name: true } },
        _count: { select: { logs: true } },
      },
      orderBy: { lastRunAt: { sort: 'desc', nulls: 'last' } },
    })

    return NextResponse.json(sources)
  } catch (error) {
    log.error('GET /api/admin/scraping/sources', { error })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
