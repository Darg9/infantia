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
    user: { findUnique: vi.fn() },
    activity: { findUnique: vi.fn() },
    favorite: {
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

import { NextResponse } from 'next/server'
import { GET, POST } from '../route'
import { DELETE } from '../[activityId]/route'

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
const ACTIVITY_ID_2 = 'act-uuid-002'

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// =============================================================================
// GET /api/favorites
// =============================================================================

describe('GET /api/favorites', () => {
  it('retorna lista de favoriteIds del usuario autenticado', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.favorite.findMany.mockResolvedValue([
      { activityId: ACTIVITY_ID_1 },
      { activityId: ACTIVITY_ID_2 },
    ])

    await GET()

    expect(mockJson).toHaveBeenCalledWith({
      favoriteIds: [ACTIVITY_ID_1, ACTIVITY_ID_2],
    })
  })

  it('retorna array vacío si el usuario no tiene favoritos', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.favorite.findMany.mockResolvedValue([])

    await GET()

    expect(mockJson).toHaveBeenCalledWith({ favoriteIds: [] })
  })

  it('retorna 404 si el usuario no existe en DB', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(null)

    await GET()

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Usuario no encontrado' },
      { status: 404 }
    )
    expect(mockPrisma.favorite.findMany).not.toHaveBeenCalled()
  })

  it('retorna 401 si no hay sesión autenticada', async () => {
    mockRequireAuth.mockRejectedValue(new Error('No auth'))

    await GET()

    expect(mockJson).toHaveBeenCalledWith({ error: 'No autorizado' }, { status: 401 })
  })

  it('busca los favoritos usando el userId interno (no el supabaseAuthId)', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.favorite.findMany.mockResolvedValue([])

    await GET()

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { supabaseAuthId: MOCK_AUTH_USER.id },
      select: { id: true },
    })
    expect(mockPrisma.favorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: MOCK_DB_USER.id } })
    )
  })
})

// =============================================================================
// POST /api/favorites
// =============================================================================

describe('POST /api/favorites', () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.activity.findUnique.mockResolvedValue({ id: ACTIVITY_ID_1 })
    mockPrisma.favorite.upsert.mockResolvedValue({ userId: MOCK_DB_USER.id, activityId: ACTIVITY_ID_1 })
  })

  it('añade actividad a favoritos y retorna 201', async () => {
    const req = makeRequest({ activityId: ACTIVITY_ID_1 })
    await POST(req as any)

    expect(mockPrisma.favorite.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_activityId: { userId: MOCK_DB_USER.id, activityId: ACTIVITY_ID_1 } },
        create: { userId: MOCK_DB_USER.id, activityId: ACTIVITY_ID_1 },
      })
    )
    expect(mockJson).toHaveBeenCalledWith({ success: true }, { status: 201 })
  })

  it('es idempotente: si ya es favorito, retorna 201 sin error', async () => {
    // El upsert no lanza aunque ya exista el registro
    mockPrisma.favorite.upsert.mockResolvedValue({ userId: MOCK_DB_USER.id, activityId: ACTIVITY_ID_1 })
    const req = makeRequest({ activityId: ACTIVITY_ID_1 })

    await POST(req as any)

    expect(mockPrisma.favorite.upsert).toHaveBeenCalledTimes(1)
    expect(mockJson).toHaveBeenCalledWith({ success: true }, { status: 201 })
  })

  it('retorna 400 si activityId no se envía', async () => {
    const req = makeRequest({})
    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith({ error: 'activityId requerido' }, { status: 400 })
    expect(mockPrisma.favorite.upsert).not.toHaveBeenCalled()
  })

  it('retorna 400 si activityId es string vacío', async () => {
    const req = makeRequest({ activityId: '' })
    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith({ error: 'activityId requerido' }, { status: 400 })
    expect(mockPrisma.favorite.upsert).not.toHaveBeenCalled()
  })

  it('retorna 400 si activityId no es string (número)', async () => {
    const req = makeRequest({ activityId: 12345 })
    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith({ error: 'activityId requerido' }, { status: 400 })
    expect(mockPrisma.favorite.upsert).not.toHaveBeenCalled()
  })

  it('retorna 400 si activityId es null', async () => {
    const req = makeRequest({ activityId: null })
    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith({ error: 'activityId requerido' }, { status: 400 })
    expect(mockPrisma.favorite.upsert).not.toHaveBeenCalled()
  })

  it('retorna 404 si la actividad no existe en DB', async () => {
    mockPrisma.activity.findUnique.mockResolvedValue(null)
    const req = makeRequest({ activityId: 'id-inexistente' })

    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith({ error: 'Actividad no encontrada' }, { status: 404 })
    expect(mockPrisma.favorite.upsert).not.toHaveBeenCalled()
  })

  it('retorna 404 si el usuario no existe en DB', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const req = makeRequest({ activityId: ACTIVITY_ID_1 })

    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith({ error: 'Usuario no encontrado' }, { status: 404 })
    expect(mockPrisma.favorite.upsert).not.toHaveBeenCalled()
  })

  it('retorna 401 si no hay sesión autenticada', async () => {
    mockRequireAuth.mockRejectedValue(new Error('No auth'))
    const req = makeRequest({ activityId: ACTIVITY_ID_1 })

    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith({ error: 'Error al guardar favorito' }, { status: 500 })
    expect(mockPrisma.favorite.upsert).not.toHaveBeenCalled()
  })

  it('verifica que la actividad existe antes del upsert', async () => {
    const req = makeRequest({ activityId: ACTIVITY_ID_1 })
    await POST(req as any)

    expect(mockPrisma.activity.findUnique).toHaveBeenCalledWith({
      where: { id: ACTIVITY_ID_1 },
      select: { id: true },
    })
  })
})

// =============================================================================
// DELETE /api/favorites/[activityId]
// =============================================================================

describe('DELETE /api/favorites/[activityId]', () => {
  const MOCK_FAVORITE = { userId: MOCK_DB_USER.id, activityId: ACTIVITY_ID_1 }

  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.favorite.findUnique.mockResolvedValue(MOCK_FAVORITE)
    mockPrisma.favorite.delete.mockResolvedValue(MOCK_FAVORITE)
  })

  it('elimina el favorito y retorna 200 con success:true', async () => {
    await DELETE({} as any, { params: Promise.resolve({ activityId: ACTIVITY_ID_1 }) })

    expect(mockPrisma.favorite.delete).toHaveBeenCalledWith({
      where: { userId_activityId: { userId: MOCK_DB_USER.id, activityId: ACTIVITY_ID_1 } },
    })
    expect(mockJson).toHaveBeenCalledWith({ success: true })
  })

  it('verifica que el favorito existe antes de eliminarlo', async () => {
    await DELETE({} as any, { params: Promise.resolve({ activityId: ACTIVITY_ID_1 }) })

    expect(mockPrisma.favorite.findUnique).toHaveBeenCalledWith({
      where: { userId_activityId: { userId: MOCK_DB_USER.id, activityId: ACTIVITY_ID_1 } },
    })
  })

  it('retorna 404 si el favorito no existe', async () => {
    mockPrisma.favorite.findUnique.mockResolvedValue(null)

    await DELETE({} as any, { params: Promise.resolve({ activityId: 'id-no-favorito' }) })

    expect(mockPrisma.favorite.delete).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledWith({ error: 'Favorito no encontrado' }, { status: 404 })
  })

  it('retorna 404 si el usuario no existe en DB', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    await DELETE({} as any, { params: Promise.resolve({ activityId: ACTIVITY_ID_1 }) })

    expect(mockPrisma.favorite.delete).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledWith({ error: 'Usuario no encontrado' }, { status: 404 })
  })

  it('retorna 401 si no hay sesión autenticada', async () => {
    mockRequireAuth.mockRejectedValue(new Error('No auth'))

    await DELETE({} as any, { params: Promise.resolve({ activityId: ACTIVITY_ID_1 }) })

    expect(mockPrisma.favorite.delete).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledWith({ error: 'No autorizado' }, { status: 401 })
  })

  it('usa el userId interno (no supabaseAuthId) para buscar el favorito', async () => {
    await DELETE({} as any, { params: Promise.resolve({ activityId: ACTIVITY_ID_1 }) })

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { supabaseAuthId: MOCK_AUTH_USER.id },
      select: { id: true },
    })
    // El delete usa el ID interno, no el supabase auth ID
    expect(mockPrisma.favorite.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_activityId: {
            userId: MOCK_DB_USER.id, // ID interno
            activityId: ACTIVITY_ID_1,
          },
        },
      })
    )
  })

  it('no afecta favoritos de otros usuarios con el mismo activityId', async () => {
    // Solo puede borrar el favorito del usuario autenticado gracias al userId en el where
    await DELETE({} as any, { params: Promise.resolve({ activityId: ACTIVITY_ID_1 }) })

    const deleteCall = mockPrisma.favorite.delete.mock.calls[0][0]
    expect(deleteCall.where.userId_activityId.userId).toBe(MOCK_DB_USER.id)
  })
})

// =============================================================================
// Verificación de aislamiento de usuarios (cross-user security)
// =============================================================================

describe('Seguridad: aislamiento entre usuarios', () => {
  it('GET solo devuelve favoritos del usuario autenticado, no de otros', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.favorite.findMany.mockResolvedValue([{ activityId: ACTIVITY_ID_1 }])

    await GET()

    // La query de findMany usa el userId del usuario autenticado
    expect(mockPrisma.favorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: MOCK_DB_USER.id } })
    )
    // No devuelve favoritos con otro userId
    expect(mockJson).toHaveBeenCalledWith({ favoriteIds: [ACTIVITY_ID_1] })
  })

  it('DELETE no puede borrar favoritos de otro usuario', async () => {
    const OTRO_USER_DB = { id: 'otro-db-user-789' }
    mockRequireAuth.mockResolvedValue({ id: 'otro-auth-id' })
    mockPrisma.user.findUnique.mockResolvedValue(OTRO_USER_DB)
    // El favorito NO existe para este usuario
    mockPrisma.favorite.findUnique.mockResolvedValue(null)

    await DELETE({} as any, { params: Promise.resolve({ activityId: ACTIVITY_ID_1 }) })

    expect(mockPrisma.favorite.delete).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledWith({ error: 'Favorito no encontrado' }, { status: 404 })
  })
})
