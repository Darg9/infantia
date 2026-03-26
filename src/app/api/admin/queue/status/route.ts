// =============================================================================
// GET /api/admin/queue/status — Estado de la cola de scraping (BullMQ)
// =============================================================================

import { NextResponse } from 'next/server'
import { getScrapingQueue, closeScrapingQueue } from '@/modules/scraping/queue'

export async function GET() {
  try {
    const queue = getScrapingQueue()

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ])

    const recentFailed = await queue.getFailed(0, 9)
    const recentCompleted = await queue.getCompleted(0, 9)

    return NextResponse.json({
      counts: { waiting, active, completed, failed, delayed },
      recentFailed: recentFailed.map((j) => ({
        id: j.id,
        name: j.name,
        data: { type: j.data.type, url: j.data.url ?? (j.data as any).profileUrl },
        attemptsMade: j.attemptsMade,
        failedReason: j.failedReason,
        finishedOn: j.finishedOn,
      })),
      recentCompleted: recentCompleted.map((j) => ({
        id: j.id,
        name: j.name,
        data: { type: j.data.type, url: j.data.url ?? (j.data as any).profileUrl },
        returnvalue: j.returnvalue,
        finishedOn: j.finishedOn,
      })),
    })
  } catch (error) {
    console.error('GET /api/admin/queue/status error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
