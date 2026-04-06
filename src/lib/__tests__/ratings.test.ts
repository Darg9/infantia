import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    rating: {
      aggregate: vi.fn(),
    },
    provider: {
      update: vi.fn(),
    },
  }
  return { mockPrisma }
})

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

import { recalcProviderRating } from '../ratings'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recalcProviderRating', () => {
  it('actualiza ratingAvg y ratingCount con datos reales', async () => {
    mockPrisma.rating.aggregate.mockResolvedValue({
      _avg:   { score: 4.5 },
      _count: { score: 10 },
    })
    mockPrisma.provider.update.mockResolvedValue({})

    await recalcProviderRating('provider-123')

    expect(mockPrisma.rating.aggregate).toHaveBeenCalledWith({
      where: { activity: { providerId: 'provider-123' } },
      _avg:   { score: true },
      _count: { score: true },
    })

    expect(mockPrisma.provider.update).toHaveBeenCalledWith({
      where: { id: 'provider-123' },
      data: { ratingAvg: 4.5, ratingCount: 10 },
    })
  })

  it('usa null para ratingAvg cuando no hay ratings (_avg.score = null)', async () => {
    mockPrisma.rating.aggregate.mockResolvedValue({
      _avg:   { score: null },
      _count: { score: 0 },
    })
    mockPrisma.provider.update.mockResolvedValue({})

    await recalcProviderRating('provider-sin-ratings')

    expect(mockPrisma.provider.update).toHaveBeenCalledWith({
      where: { id: 'provider-sin-ratings' },
      data: { ratingAvg: null, ratingCount: 0 },
    })
  })

  it('propaga errores de Prisma', async () => {
    mockPrisma.rating.aggregate.mockRejectedValue(new Error('DB connection failed'))

    await expect(recalcProviderRating('provider-error')).rejects.toThrow('DB connection failed')
  })
})
