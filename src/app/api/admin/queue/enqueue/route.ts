// =============================================================================
// POST /api/admin/queue/enqueue — Encolar un job de scraping desde el panel
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { enqueueBatchJob, enqueueInstagramJob } from '@/modules/scraping/queue'
import { z } from 'zod'
import { createLogger } from '@/lib/logger';

const log = createLogger('api:queue:enqueue');

const batchSchema = z.object({
  type: z.literal('batch'),
  url: z.string().url(),
  cityName: z.string().min(1),
  verticalSlug: z.string().min(1),
  maxPages: z.number().int().min(1).max(50).optional(),
  sitemapPatterns: z.array(z.string()).optional(),
})

const instagramSchema = z.object({
  type: z.literal('instagram'),
  profileUrl: z.string().url(),
  cityName: z.string().min(1),
  verticalSlug: z.string().min(1),
})

const bodySchema = z.discriminatedUnion('type', [batchSchema, instagramSchema])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = bodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const data = parsed.data
    let jobId: string

    if (data.type === 'batch') {
      jobId = await enqueueBatchJob({
        url: data.url,
        cityName: data.cityName,
        verticalSlug: data.verticalSlug,
        maxPages: data.maxPages,
        sitemapPatterns: data.sitemapPatterns,
      })
    } else {
      jobId = await enqueueInstagramJob({
        profileUrl: data.profileUrl,
        cityName: data.cityName,
        verticalSlug: data.verticalSlug,
      })
    }

    return NextResponse.json({ jobId, message: `Job ${jobId} encolado correctamente` }, { status: 201 })
  } catch (error) {
    log.error('POST /api/admin/queue/enqueue', { error })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
