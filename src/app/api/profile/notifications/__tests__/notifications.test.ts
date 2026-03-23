import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init?) => ({ _data: data, _status: init?.status ?? 200 })),
  },
}))

const { mockRequireAuth, mockPrisma } = vi.hoisted(() => {
  const mockRequireAuth = vi.fn()
  const mockPrisma = {
    user: { findUnique: vi.fn(), update: vi.fn() },
  }
  return { mockRequireAuth, mockPrisma }
})

vi.mock('@/lib/auth', () => ({ requireAuth: mockRequireAuth }))
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

import { GET, PUT } from '../route'

const mockJson = vi.mocked(NextResponse.json)
const MOCK_AUTH_USER = { id: 'auth-user-123' }

function makeRequest(body?: object): Request {
  return { json: async () => body } as unknown as Request
}

describe('GET /api/profile/notifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns prefs from DB merged with defaults', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue({
      notificationPrefs: { email: false, frequency: 'weekly' },
    })

    await GET()

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { supabaseAuthId: 'auth-user-123' },
      select: { notificationPrefs: true },
    })
    expect(mockJson).toHaveBeenCalledWith({
      prefs: {
        email: false,
        push: true,
        frequency: 'weekly',
        categories: {
          newActivities: true,
          favoritesUpdates: true,
          providerAnnouncements: false,
        },
      },
    })
  })

  it('returns 404 when user not found', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(null)

    await GET()

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Usuario no encontrado' },
      { status: 404 }
    )
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('No auth'))

    await GET()

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'No autorizado' },
      { status: 401 }
    )
  })
})

describe('PUT /api/profile/notifications', () => {
  beforeEach(() => vi.clearAllMocks())

  const validBody = {
    email: true,
    push: false,
    frequency: 'weekly',
    categories: {
      newActivities: true,
      favoritesUpdates: false,
      providerAnnouncements: true,
    },
  }

  it('successfully updates prefs', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.update.mockResolvedValue({})

    await PUT(makeRequest(validBody) as any)

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { supabaseAuthId: 'auth-user-123' },
      data: {
        notificationPrefs: {
          email: true,
          push: false,
          frequency: 'weekly',
          categories: {
            newActivities: true,
            favoritesUpdates: false,
            providerAnnouncements: true,
          },
        },
      },
    })
    expect(mockJson).toHaveBeenCalledWith({
      success: true,
      prefs: {
        email: true,
        push: false,
        frequency: 'weekly',
        categories: {
          newActivities: true,
          favoritesUpdates: false,
          providerAnnouncements: true,
        },
      },
    })
  })

  it('returns 400 when email is not a boolean', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)

    await PUT(makeRequest({ ...validBody, email: 'yes' }) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'email y push deben ser booleanos' },
      { status: 400 }
    )
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('returns 400 when frequency is invalid', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)

    await PUT(makeRequest({ ...validBody, frequency: 'monthly' }) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'frequency debe ser daily, weekly o none' },
      { status: 400 }
    )
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('returns 400 when categories is not an object', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)

    await PUT(makeRequest({ ...validBody, categories: 'invalid' }) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'categories debe ser un objeto' },
      { status: 400 }
    )
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('returns 500 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('No auth'))

    await PUT(makeRequest(validBody) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Error al actualizar preferencias' },
      { status: 500 }
    )
  })
})
