import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init?) => ({ _data: data, _status: init?.status ?? 200 })),
  },
}))

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    rating: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
  }
  return { mockPrisma }
})

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

import { NextResponse } from 'next/server'
import { GET } from '../route'

const mockJson = vi.mocked(NextResponse.json)

beforeEach(() => {
  vi.clearAllMocks()
})

function makeRequest(searchParams: Record<string, string> = {}): import('next/server').NextRequest {
  const url = new URL('http://localhost/api/activities/act-1/ratings')
  Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  return { url: url.toString(), nextUrl: url } as unknown as import('next/server').NextRequest
}

const ACTIVITY_ID = 'act-uuid-001'
const makeParams = () => ({ params: Promise.resolve({ id: ACTIVITY_ID }) })

describe('GET /api/activities/[id]/ratings', () => {
  it('retorna ratings paginados de una actividad', async () => {
    const ratings = [
      {
        id: 'r1',
        score: 5,
        comment: 'Excelente',
        createdAt: new Date('2026-03-18'),
        user: { name: 'Juan', avatarUrl: null },
      },
    ]
    mockPrisma.rating.findMany.mockResolvedValue(ratings)
    mockPrisma.rating.count.mockResolvedValue(1)
    mockPrisma.rating.aggregate.mockResolvedValue({ _avg: { score: 5 } })

    await GET(makeRequest(), makeParams())

    expect(mockJson).toHaveBeenCalledWith({
      ratings: [
        {
          id: 'r1',
          score: 5,
          comment: 'Excelente',
          createdAt: new Date('2026-03-18'),
          user: { name: 'Juan', avatarUrl: null },
        },
      ],
      total: 1,
      average: 5,
      page: 1,
      limit: 10,
    })
  })

  it('retorna array vacio si no hay ratings', async () => {
    mockPrisma.rating.findMany.mockResolvedValue([])
    mockPrisma.rating.count.mockResolvedValue(0)

    await GET(makeRequest(), makeParams())

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        ratings: [],
        total: 0,
        average: 0,
      })
    )
  })

  it('respeta parametros de paginacion', async () => {
    mockPrisma.rating.findMany.mockResolvedValue([])
    mockPrisma.rating.count.mockResolvedValue(0)

    await GET(makeRequest({ page: '2', limit: '5' }), makeParams())

    expect(mockPrisma.rating.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 })
    )
  })

  it('limita el maximo de limit a 50', async () => {
    mockPrisma.rating.findMany.mockResolvedValue([])
    mockPrisma.rating.count.mockResolvedValue(0)

    await GET(makeRequest({ limit: '100' }), makeParams())

    expect(mockPrisma.rating.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    )
  })

  it('calcula el promedio correctamente', async () => {
    mockPrisma.rating.findMany.mockResolvedValue([
      { id: 'r1', score: 4, comment: null, createdAt: new Date(), user: { name: 'A', avatarUrl: null } },
    ])
    mockPrisma.rating.count.mockResolvedValue(3)
    mockPrisma.rating.aggregate.mockResolvedValue({ _avg: { score: 3.667 } })

    await GET(makeRequest(), makeParams())

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ average: 3.7 })
    )
  })

  it('usa page=1 y limit=10 por defecto', async () => {
    mockPrisma.rating.findMany.mockResolvedValue([])
    mockPrisma.rating.count.mockResolvedValue(0)

    await GET(makeRequest(), makeParams())

    expect(mockPrisma.rating.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 })
    )
  })
})
