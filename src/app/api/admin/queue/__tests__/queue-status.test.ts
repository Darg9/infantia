import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockQueue = {
  getWaitingCount: vi.fn(),
  getActiveCount: vi.fn(),
  getCompletedCount: vi.fn(),
  getFailedCount: vi.fn(),
  getDelayedCount: vi.fn(),
  getFailed: vi.fn(),
  getCompleted: vi.fn(),
}

vi.mock('@/modules/scraping/queue', () => ({
  getScrapingQueue: vi.fn(() => mockQueue),
  closeScrapingQueue: vi.fn(),
  enqueueBatchJob: vi.fn(),
  enqueueInstagramJob: vi.fn(),
}))

import { GET } from '../status/route'
import { POST } from '../enqueue/route'
import { enqueueBatchJob, enqueueInstagramJob } from '@/modules/scraping/queue'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, method = 'POST'): NextRequest {
  return new NextRequest('http://localhost/api/admin/queue/enqueue', {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

// ── GET /api/admin/queue/status ────────────────────────────────────────────────

describe('GET /api/admin/queue/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueue.getWaitingCount.mockResolvedValue(3)
    mockQueue.getActiveCount.mockResolvedValue(1)
    mockQueue.getCompletedCount.mockResolvedValue(42)
    mockQueue.getFailedCount.mockResolvedValue(2)
    mockQueue.getDelayedCount.mockResolvedValue(0)
    mockQueue.getFailed.mockResolvedValue([
      {
        id: 'j1',
        name: 'batch',
        data: { type: 'batch', url: 'https://example.com' },
        attemptsMade: 3,
        failedReason: 'fetch failed',
        finishedOn: 1700000000000,
      },
    ])
    mockQueue.getCompleted.mockResolvedValue([
      {
        id: 'j2',
        name: 'batch',
        data: { type: 'batch', url: 'https://banrepcultural.org' },
        returnvalue: { saved: 12, failed: 0 },
        finishedOn: 1700000001000,
      },
    ])
  })

  it('devuelve counts y jobs recientes', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.counts).toEqual({ waiting: 3, active: 1, completed: 42, failed: 2, delayed: 0 })
    expect(body.recentFailed).toHaveLength(1)
    expect(body.recentFailed[0].id).toBe('j1')
    expect(body.recentFailed[0].failedReason).toBe('fetch failed')
    expect(body.recentCompleted).toHaveLength(1)
    expect(body.recentCompleted[0].returnvalue).toEqual({ saved: 12, failed: 0 })
  })

  it('devuelve 500 si la queue lanza error', async () => {
    mockQueue.getWaitingCount.mockRejectedValue(new Error('Redis down'))
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Error interno')
  })
})

// ── POST /api/admin/queue/enqueue ──────────────────────────────────────────────

describe('POST /api/admin/queue/enqueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(enqueueBatchJob).mockResolvedValue('job-123')
    vi.mocked(enqueueInstagramJob).mockResolvedValue('job-456')
  })

  it('encola batch job y devuelve jobId', async () => {
    const req = makeRequest({
      type: 'batch',
      url: 'https://cinematecadebogota.gov.co/agenda/11',
      cityName: 'Bogotá',
      verticalSlug: 'kids',
      maxPages: 5,
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.jobId).toBe('job-123')
    expect(enqueueBatchJob).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://cinematecadebogota.gov.co/agenda/11', cityName: 'Bogotá' }),
    )
  })

  it('encola instagram job y devuelve jobId', async () => {
    const req = makeRequest({
      type: 'instagram',
      profileUrl: 'https://instagram.com/habitaplan',
      cityName: 'Bogotá',
      verticalSlug: 'kids',
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.jobId).toBe('job-456')
    expect(enqueueInstagramJob).toHaveBeenCalled()
  })

  it('devuelve 400 si faltan campos requeridos', async () => {
    const req = makeRequest({ type: 'batch', url: 'https://example.com' }) // sin cityName
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Datos inválidos')
  })

  it('devuelve 400 si la URL es inválida', async () => {
    const req = makeRequest({ type: 'batch', url: 'no-es-url', cityName: 'Bogotá', verticalSlug: 'kids' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('devuelve 400 si el type es desconocido', async () => {
    const req = makeRequest({ type: 'unknown', url: 'https://example.com', cityName: 'Bogotá', verticalSlug: 'kids' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('devuelve 500 si enqueueBatchJob lanza error', async () => {
    vi.mocked(enqueueBatchJob).mockRejectedValue(new Error('Redis timeout'))
    const req = makeRequest({ type: 'batch', url: 'https://example.com', cityName: 'Bogotá', verticalSlug: 'kids' })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('pasa sitemapPatterns al producer', async () => {
    const req = makeRequest({
      type: 'batch',
      url: 'https://www.banrepcultural.org/sitemap.xml',
      cityName: 'Bogotá',
      verticalSlug: 'kids',
      sitemapPatterns: ['/bogota/'],
    })
    await POST(req)
    expect(enqueueBatchJob).toHaveBeenCalledWith(
      expect.objectContaining({ sitemapPatterns: ['/bogota/'] }),
    )
  })
})
