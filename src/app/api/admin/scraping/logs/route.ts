// =============================================================================
// GET /api/admin/scraping/logs — List scraping logs with pagination
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger';

const log = createLogger('api:scraping:logs');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10) || 20))
    const sourceId = searchParams.get('sourceId')

    const where = sourceId ? { sourceId } : {}

    const [logs, total] = await Promise.all([
      prisma.scrapingLog.findMany({
        where,
        include: {
          source: { select: { name: true, platform: true, url: true } },
        },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.scrapingLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    log.error('GET /api/admin/scraping/logs', { error })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
