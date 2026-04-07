import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init?) => ({ _data: data, _status: init?.status ?? 200 })),
  },
}))

const { mockRequireAuth, mockPrisma } = vi.hoisted(() => {
  const mockRequireAuth = vi.fn()
  const mockPrisma = {
    user: { findUnique: vi.fn(), upsert: vi.fn() },
    activity: { findUnique: vi.fn() },
    rating: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  }
  return { mockRequireAuth, mockPrisma }
})

vi.mock('@/lib/auth', () => ({ requireAuth: mockRequireAuth }))
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/ratings', () => ({ recalcProviderRating: vi.fn().mockResolvedValue(undefined) }))

import { NextResponse } from 'next/server'
import { GET, POST } from '../route'
import { GET as GET_BY_ACTIVITY, DELETE } from '../[activityId]/route'

const mockJson = vi.mocked(NextResponse.json)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body?: object): Request {
  return {
    json: async () => body,
  } as unknown as Request
}

const MOCK_AUTH_USER = { id: 'auth-user-123' }
const MOCK_DB_USER = { id: 'db-user-456' }
const ACTIVITY_ID_1 = 'act-uuid-001'

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// =============================================================================
// GET /api/ratings
// =============================================================================

describe('GET /api/ratings', () => {
  it('retorna lista de calificaciones del usuario autenticado', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)
    const ratings = [
      { id: 'r1', score: 5, comment: 'Excelente', activity: { id: ACTIVITY_ID_1, title: 'Taller', imageUrl: null, status: 'ACTIVE' } },
    ]
    mockPrisma.rating.findMany.mockResolvedValue(ratings)

    await GET()

    expect(mockPrisma.rating.findMany).toHaveBeenCalledWith({
      where: { userId: MOCK_DB_USER.id },
      orderBy: { createdAt: 'desc' },
      include: {
        activity: {
          select: { id: true, title: true, imageUrl: true, status: true },
        },
      },
    })
    expect(mockJson).toHaveBeenCalledWith({ ratings })
  })

  it('retorna arreglo vacio si el usuario no tiene calificaciones', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.rating.findMany.mockResolvedValue([])

    await GET()

    expect(mockJson).toHaveBeenCalledWith({ ratings: [] })
  })

  it('retorna 404 si el usuario no existe en la BD', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(null)

    await GET()

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Usuario no encontrado' },
      { status: 404 },
    )
  })

  it('retorna 401 si requireAuth lanza error', async () => {
    mockRequireAuth.mockRejectedValue(new Error('No auth'))

    await GET()

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'No autorizado' },
      { status: 401 },
    )
  })
})

// =============================================================================
// POST /api/ratings
// =============================================================================

describe('POST /api/ratings', () => {
  it('crea una nueva calificacion exitosamente', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.upsert.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.activity.findUnique.mockResolvedValue({ id: ACTIVITY_ID_1, providerId: 'prov-1' })
    const rating = { id: 'r1', userId: MOCK_DB_USER.id, activityId: ACTIVITY_ID_1, score: 4, comment: null }
    mockPrisma.rating.upsert.mockResolvedValue(rating)

    await POST(makeRequest({ activityId: ACTIVITY_ID_1, score: 4 }) as any)

    expect(mockPrisma.rating.upsert).toHaveBeenCalledWith({
      where: { userId_activityId: { userId: MOCK_DB_USER.id, activityId: ACTIVITY_ID_1 } },
      create: { userId: MOCK_DB_USER.id, activityId: ACTIVITY_ID_1, score: 4, comment: null },
      update: { score: 4, comment: null },
    })
    expect(mockJson).toHaveBeenCalledWith({ success: true, rating }, { status: 201 })
  })

  it('crea calificacion con comentario', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.upsert.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.activity.findUnique.mockResolvedValue({ id: ACTIVITY_ID_1, providerId: 'prov-1' })
    const rating = { id: 'r2', score: 3, comment: 'Bueno' }
    mockPrisma.rating.upsert.mockResolvedValue(rating)

    await POST(makeRequest({ activityId: ACTIVITY_ID_1, score: 3, comment: '  Bueno  ' }) as any)

    expect(mockPrisma.rating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ comment: 'Bueno' }),
        update: expect.objectContaining({ comment: 'Bueno' }),
      }),
    )
  })

  it('upsert actualiza calificacion existente', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.upsert.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.activity.findUnique.mockResolvedValue({ id: ACTIVITY_ID_1, providerId: 'prov-1' })
    const updated = { id: 'r1', score: 5, comment: null }
    mockPrisma.rating.upsert.mockResolvedValue(updated)

    await POST(makeRequest({ activityId: ACTIVITY_ID_1, score: 5 }) as any)

    expect(mockPrisma.rating.upsert).toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledWith({ success: true, rating: updated }, { status: 201 })
  })

  it('upsert crea el usuario en BD si no existe (no lanza 404)', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.upsert.mockResolvedValue(MOCK_DB_USER) // upsert siempre devuelve usuario
    mockPrisma.activity.findUnique.mockResolvedValue({ id: ACTIVITY_ID_1, providerId: 'prov-1' })
    mockPrisma.rating.upsert.mockResolvedValue({ id: 'r1', score: 3 })

    await POST(makeRequest({ activityId: ACTIVITY_ID_1, score: 3 }) as any)

    expect(mockPrisma.user.upsert).toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
      { status: 201 },
    )
  })

  it('retorna 400 si falta activityId', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.upsert.mockResolvedValue(MOCK_DB_USER)

    await POST(makeRequest({ score: 3 }) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'activityId requerido' },
      { status: 400 },
    )
  })

  it('retorna 400 si score es 0', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.upsert.mockResolvedValue(MOCK_DB_USER)

    await POST(makeRequest({ activityId: ACTIVITY_ID_1, score: 0 }) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'score debe ser un entero entre 1 y 5' },
      { status: 400 },
    )
  })

  it('retorna 400 si score es 6', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.upsert.mockResolvedValue(MOCK_DB_USER)

    await POST(makeRequest({ activityId: ACTIVITY_ID_1, score: 6 }) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'score debe ser un entero entre 1 y 5' },
      { status: 400 },
    )
  })

  it('retorna 400 si score es decimal (3.5)', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.upsert.mockResolvedValue(MOCK_DB_USER)

    await POST(makeRequest({ activityId: ACTIVITY_ID_1, score: 3.5 }) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'score debe ser un entero entre 1 y 5' },
      { status: 400 },
    )
  })

  it('retorna 400 si score no es numero', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.upsert.mockResolvedValue(MOCK_DB_USER)

    await POST(makeRequest({ activityId: ACTIVITY_ID_1, score: 'tres' }) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'score debe ser un entero entre 1 y 5' },
      { status: 400 },
    )
  })

  it('retorna 400 si comment excede 500 caracteres', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.upsert.mockResolvedValue(MOCK_DB_USER)

    const longComment = 'a'.repeat(501)
    await POST(makeRequest({ activityId: ACTIVITY_ID_1, score: 4, comment: longComment }) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'comment debe ser texto (max 500 caracteres)' },
      { status: 400 },
    )
  })

  it('retorna 404 si la actividad no existe', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.upsert.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.activity.findUnique.mockResolvedValue(null)

    await POST(makeRequest({ activityId: 'no-existe', score: 3 }) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Actividad no encontrada' },
      { status: 404 },
    )
  })
})

// =============================================================================
// GET /api/ratings/[activityId]
// =============================================================================

describe('GET /api/ratings/[activityId]', () => {
  it('retorna la calificacion del usuario para la actividad', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)
    const rating = { id: 'r1', score: 4, comment: 'Muy bien' }
    mockPrisma.rating.findUnique.mockResolvedValue(rating)

    await GET_BY_ACTIVITY(makeRequest() as any, { params: Promise.resolve({ activityId: ACTIVITY_ID_1 }) })

    expect(mockPrisma.rating.findUnique).toHaveBeenCalledWith({
      where: { userId_activityId: { userId: MOCK_DB_USER.id, activityId: ACTIVITY_ID_1 } },
    })
    expect(mockJson).toHaveBeenCalledWith({ rating })
  })

  it('retorna rating null si el usuario no ha calificado la actividad', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.rating.findUnique.mockResolvedValue(null)

    await GET_BY_ACTIVITY(makeRequest() as any, { params: Promise.resolve({ activityId: ACTIVITY_ID_1 }) })

    expect(mockJson).toHaveBeenCalledWith({ rating: null })
  })

  it('retorna 401 si requireAuth lanza error', async () => {
    mockRequireAuth.mockRejectedValue(new Error('No auth'))

    await GET_BY_ACTIVITY(makeRequest() as any, { params: Promise.resolve({ activityId: ACTIVITY_ID_1 }) })

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'No autorizado' },
      { status: 401 },
    )
  })
})

// =============================================================================
// DELETE /api/ratings/[activityId]
// =============================================================================

describe('DELETE /api/ratings/[activityId]', () => {
  it('elimina la calificacion exitosamente', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.rating.findUnique.mockResolvedValue({ id: 'r1', userId: MOCK_DB_USER.id, activityId: ACTIVITY_ID_1, activity: { providerId: 'prov-1' } })
    mockPrisma.rating.delete.mockResolvedValue({})

    await DELETE(makeRequest() as any, { params: Promise.resolve({ activityId: ACTIVITY_ID_1 }) })

    expect(mockPrisma.rating.delete).toHaveBeenCalledWith({
      where: { userId_activityId: { userId: MOCK_DB_USER.id, activityId: ACTIVITY_ID_1 } },
    })
    expect(mockJson).toHaveBeenCalledWith({ success: true })
  })

  it('retorna 404 si la calificacion no existe', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.rating.findUnique.mockResolvedValue(null)

    await DELETE(makeRequest() as any, { params: Promise.resolve({ activityId: ACTIVITY_ID_1 }) })

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Calificacion no encontrada' },
      { status: 404 },
    )
    expect(mockPrisma.rating.delete).not.toHaveBeenCalled()
  })

  it('retorna 404 si el usuario no existe en la BD', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(null)

    await DELETE(makeRequest() as any, { params: Promise.resolve({ activityId: ACTIVITY_ID_1 }) })

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Usuario no encontrado' },
      { status: 404 },
    )
  })
})
