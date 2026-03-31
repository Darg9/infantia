import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init?) => ({ _data: data, _status: init?.status ?? 200 })),
  },
}))

const { mockRequireRole, mockPrisma } = vi.hoisted(() => {
  const mockRequireRole = vi.fn()
  const mockPrisma = {
    sponsor: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
  return { mockRequireRole, mockPrisma }
})

vi.mock('@/lib/auth', () => ({ requireRole: mockRequireRole }))
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/generated/prisma/client', () => ({ UserRole: { ADMIN: 'ADMIN' } }))

import { NextResponse } from 'next/server'
import { GET, POST } from '../route'
import { PATCH, DELETE } from '../[id]/route'

const mockJson = vi.mocked(NextResponse.json)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body?: object): any {
  return { json: async () => body } as unknown as Request
}

function makeParamsRequest(body?: object, id = 'sponsor-1'): { req: any; params: Promise<{ id: string }> } {
  return {
    req: makeRequest(body),
    params: Promise.resolve({ id }),
  }
}

const SAMPLE_SPONSOR = {
  id: 'sponsor-1',
  name: 'Acme Corp',
  tagline: 'Calidad garantizada',
  logoUrl: 'https://acme.com/logo.png',
  url: 'https://acme.com',
  isActive: true,
  campaignStart: null,
  campaignEnd: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireRole.mockResolvedValue(undefined)
})

// =============================================================================
// GET /api/admin/sponsors
// =============================================================================

describe('GET /api/admin/sponsors', () => {
  it('retorna lista de sponsors', async () => {
    mockPrisma.sponsor.findMany.mockResolvedValue([SAMPLE_SPONSOR])
    await GET()
    const data = mockJson.mock.calls[0][0] as any
    expect(Array.isArray(data)).toBe(true)
    expect(data[0].name).toBe('Acme Corp')
  })

  it('retorna 401 si no es admin', async () => {
    mockRequireRole.mockRejectedValue(new Error('Forbidden'))
    await GET()
    expect(mockJson).toHaveBeenCalledWith({ error: 'No autorizado' }, { status: 401 })
  })

  it('ordena por createdAt desc', async () => {
    mockPrisma.sponsor.findMany.mockResolvedValue([])
    await GET()
    expect(mockPrisma.sponsor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    )
  })
})

// =============================================================================
// POST /api/admin/sponsors
// =============================================================================

describe('POST /api/admin/sponsors', () => {
  it('crea un sponsor con datos válidos', async () => {
    const body = { name: 'Acme', tagline: 'Calidad', url: 'https://acme.com' }
    mockPrisma.sponsor.create.mockResolvedValue({ ...SAMPLE_SPONSOR, ...body })
    const req = makeRequest(body)
    await POST(req)
    const call = mockJson.mock.calls[0]
    expect(call[1]?.status).toBe(201)
    expect(call[0]).toMatchObject({ name: 'Acme' })
  })

  it('retorna 400 si faltan campos requeridos', async () => {
    const req = makeRequest({ name: 'Acme' }) // sin tagline y url
    await POST(req)
    const call = mockJson.mock.calls[0]
    expect(call[1]?.status).toBe(400)
  })

  it('retorna 400 si url no es válida', async () => {
    const req = makeRequest({ name: 'Acme', tagline: 'tag', url: 'no-es-url' })
    await POST(req)
    expect(mockJson.mock.calls[0][1]?.status).toBe(400)
  })

  it('retorna 401 si no es admin', async () => {
    mockRequireRole.mockRejectedValue(new Error('Forbidden'))
    const req = makeRequest({ name: 'X', tagline: 'Y', url: 'https://x.com' })
    await POST(req)
    expect(mockJson).toHaveBeenCalledWith({ error: 'No autorizado' }, { status: 401 })
  })

  it('pasa campaignStart como Date si se proporciona', async () => {
    const body = { name: 'A', tagline: 'T', url: 'https://a.com', campaignStart: '2026-04-01T00:00:00.000Z' }
    mockPrisma.sponsor.create.mockResolvedValue(SAMPLE_SPONSOR)
    await POST(makeRequest(body))
    const createArg = mockPrisma.sponsor.create.mock.calls[0][0]
    expect(createArg.data.campaignStart).toBeInstanceOf(Date)
  })
})

// =============================================================================
// PATCH /api/admin/sponsors/[id]
// =============================================================================

describe('PATCH /api/admin/sponsors/[id]', () => {
  it('actualiza sponsor con datos parciales', async () => {
    const updated = { ...SAMPLE_SPONSOR, isActive: false }
    mockPrisma.sponsor.update.mockResolvedValue(updated)
    const { req, params } = makeParamsRequest({ isActive: false })
    await PATCH(req, { params })
    expect(mockPrisma.sponsor.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sponsor-1' } })
    )
    const data = mockJson.mock.calls[0][0] as any
    expect(data.isActive).toBe(false)
  })

  it('retorna 400 si los datos no pasan validación', async () => {
    const { req, params } = makeParamsRequest({ url: 'no-es-url' })
    await PATCH(req, { params })
    expect(mockJson.mock.calls[0][1]?.status).toBe(400)
  })

  it('retorna 401 si no es admin', async () => {
    mockRequireRole.mockRejectedValue(new Error('Forbidden'))
    const { req, params } = makeParamsRequest({ isActive: true })
    await PATCH(req, { params })
    expect(mockJson).toHaveBeenCalledWith({ error: 'No autorizado' }, { status: 401 })
  })
})

// =============================================================================
// DELETE /api/admin/sponsors/[id]
// =============================================================================

describe('DELETE /api/admin/sponsors/[id]', () => {
  it('elimina un sponsor y retorna ok:true', async () => {
    mockPrisma.sponsor.delete.mockResolvedValue(SAMPLE_SPONSOR)
    const { req, params } = makeParamsRequest()
    await DELETE(req, { params })
    expect(mockPrisma.sponsor.delete).toHaveBeenCalledWith({ where: { id: 'sponsor-1' } })
    const data = mockJson.mock.calls[0][0] as any
    expect(data.ok).toBe(true)
  })

  it('retorna 401 si no es admin', async () => {
    mockRequireRole.mockRejectedValue(new Error('Forbidden'))
    const { req, params } = makeParamsRequest()
    await DELETE(req, { params })
    expect(mockJson).toHaveBeenCalledWith({ error: 'No autorizado' }, { status: 401 })
  })
})
