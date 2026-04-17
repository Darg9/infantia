import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init?) => ({ _data: data, _status: init?.status ?? 200 })),
  },
}))

const { mockRequireAuth, mockGetSession, mockGetOrCreateDbUser, mockPrisma } = vi.hoisted(() => {
  const mockRequireAuth = vi.fn()
  const mockGetSession = vi.fn()
  const mockGetOrCreateDbUser = vi.fn()
  const mockPrisma = {
    user: { findUnique: vi.fn() },
    activity: { findUnique: vi.fn() },
    location: { findUnique: vi.fn() },
    favorite: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
    },
  }
  return { mockRequireAuth, mockGetSession, mockGetOrCreateDbUser, mockPrisma }
})

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth,
  getSession: mockGetSession,
  getOrCreateDbUser: mockGetOrCreateDbUser,
}))
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

import { NextResponse } from 'next/server'
import { GET, POST } from '../route'
import { DELETE } from '../[targetId]/route'

const mockJson = vi.mocked(NextResponse.json)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body?: object, type: string = 'activity'): any {
  return {
    json: async () => body,
    nextUrl: {
      searchParams: {
        get: vi.fn().mockImplementation((key) => {
          if (key === 'type') return type
          return null
        })
      }
    }
  }
}

const MOCK_AUTH_USER = { id: 'auth-user-123' }
const MOCK_DB_USER = { id: 'db-user-456' }
const TARGET_ID_1 = 'target-uuid-001'
const TARGET_ID_2 = 'target-uuid-002'

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
    mockGetOrCreateDbUser.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.favorite.findMany.mockResolvedValue([
      { activityId: TARGET_ID_1 },
      { activityId: TARGET_ID_2 },
    ])

    await GET()

    expect(mockJson).toHaveBeenCalledWith({
      favoriteIds: [TARGET_ID_1, TARGET_ID_2],
    })
  })

  it('retorna array vacío si el usuario no tiene favoritos', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockGetOrCreateDbUser.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.favorite.findMany.mockResolvedValue([])

    await GET()

    expect(mockJson).toHaveBeenCalledWith({ favoriteIds: [] })
  })

  it('crea el usuario si no existía en DB (getOrCreateDbUser)', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockGetOrCreateDbUser.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.favorite.findMany.mockResolvedValue([])

    await GET()

    expect(mockGetOrCreateDbUser).toHaveBeenCalledWith(MOCK_AUTH_USER)
    expect(mockPrisma.favorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: MOCK_DB_USER.id } })
    )
  })

  it('retorna 401 si no hay sesión autenticada', async () => {
    mockRequireAuth.mockRejectedValue(new Error('No auth'))

    await GET()

    expect(mockJson).toHaveBeenCalledWith({ error: 'No autorizado' }, { status: 401 })
  })

  it('busca los favoritos usando el userId interno (no el supabaseAuthId)', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockGetOrCreateDbUser.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.favorite.findMany.mockResolvedValue([])

    await GET()

    expect(mockGetOrCreateDbUser).toHaveBeenCalledWith(MOCK_AUTH_USER)
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
    mockGetSession.mockResolvedValue(MOCK_AUTH_USER)
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockGetOrCreateDbUser.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.activity.findUnique.mockResolvedValue({ id: TARGET_ID_1 })
    mockPrisma.location.findUnique.mockResolvedValue({ id: TARGET_ID_1 })
    // No existe en DB por defecto
    mockPrisma.favorite.findFirst.mockResolvedValue(null)
    mockPrisma.favorite.create.mockResolvedValue({ userId: MOCK_DB_USER.id, activityId: TARGET_ID_1 })
  })

  it('añade actividad a favoritos y retorna 201', async () => {
    const req = makeRequest({ targetId: TARGET_ID_1, type: 'activity' })
    await POST(req as any)

    expect(mockPrisma.favorite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: MOCK_DB_USER.id, activityId: TARGET_ID_1 },
      })
    )
    expect(mockJson).toHaveBeenCalledWith({ success: true }, { status: 201 })
  })

  it('añade lugar a favoritos y retorna 201', async () => {
    const req = makeRequest({ targetId: TARGET_ID_1, type: 'place' })
    await POST(req as any)

    expect(mockPrisma.favorite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: MOCK_DB_USER.id, locationId: TARGET_ID_1 },
      })
    )
    expect(mockJson).toHaveBeenCalledWith({ success: true }, { status: 201 })
  })

  it('es idempotente: si ya es favorito, retorna 201 sin error y no crea otro', async () => {
    mockPrisma.favorite.findFirst.mockResolvedValue({ id: 'existing-id' })
    const req = makeRequest({ targetId: TARGET_ID_1, type: 'activity' })

    await POST(req as any)

    expect(mockPrisma.favorite.create).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledWith({ success: true }, { status: 201 })
  })

  it('retorna 400 si targetId no se envía', async () => {
    const req = makeRequest({})
    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith({ error: 'targetId requerido' }, { status: 400 })
  })

  it('retorna 400 si targetId es string vacío', async () => {
    const req = makeRequest({ targetId: '' })
    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith({ error: 'targetId requerido' }, { status: 400 })
  })

  it('retorna 400 si targetId no es string', async () => {
    const req = makeRequest({ targetId: 12345 })
    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith({ error: 'targetId requerido' }, { status: 400 })
  })

  it('retorna 404 si la actividad no existe en DB', async () => {
    mockPrisma.activity.findUnique.mockResolvedValue(null)
    const req = makeRequest({ targetId: 'id-inexistente', type: 'activity' })

    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith({ error: 'Actividad no encontrada' }, { status: 404 })
  })

  it('retorna 404 si el lugar no existe en DB', async () => {
    mockPrisma.location.findUnique.mockResolvedValue(null)
    const req = makeRequest({ targetId: 'id-inexistente', type: 'place' })

    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith({ error: 'Lugar no encontrado' }, { status: 404 })
  })

  it('crea usuario si no existía en BD (getOrCreateDbUser) y añade favorito', async () => {
    // El usuario existe en Supabase Auth pero no en la tabla users → getOrCreateDbUser lo crea
    const newDbUser = { id: 'new-db-user-789' }
    mockGetOrCreateDbUser.mockResolvedValue(newDbUser)
    mockPrisma.favorite.create.mockResolvedValue({ userId: newDbUser.id, activityId: TARGET_ID_1 })
    const req = makeRequest({ targetId: TARGET_ID_1, type: 'activity' })

    await POST(req as any)

    expect(mockGetOrCreateDbUser).toHaveBeenCalledWith(MOCK_AUTH_USER)
    expect(mockPrisma.favorite.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: newDbUser.id, activityId: TARGET_ID_1 } })
    )
    expect(mockJson).toHaveBeenCalledWith({ success: true }, { status: 201 })
  })

  it('retorna 400 si el type es inválido (no activity ni place)', async () => {
    const req = makeRequest({ targetId: TARGET_ID_1, type: 'unknown' })
    await POST(req as any)

    expect(mockPrisma.favorite.create).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledWith({ error: 'Tipo inválido' }, { status: 400 })
  })

  it('retorna 401 si no hay sesión autenticada', async () => {
    mockGetSession.mockResolvedValue(null)
    const req = makeRequest({ targetId: TARGET_ID_1 })

    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith({ error: 'No autorizado' }, { status: 401 })
  })

  it('verifica que la actividad existe antes de insertar', async () => {
    const req = makeRequest({ targetId: TARGET_ID_1, type: 'activity' })
    await POST(req as any)

    expect(mockPrisma.activity.findUnique).toHaveBeenCalledWith({
      where: { id: TARGET_ID_1 },
      select: { id: true },
    })
  })
})

// =============================================================================
// DELETE /api/favorites/[targetId]
// =============================================================================

describe('DELETE /api/favorites/[targetId]', () => {
  const MOCK_FAVORITE = { userId: MOCK_DB_USER.id, activityId: TARGET_ID_1 }

  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockGetOrCreateDbUser.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.favorite.findFirst.mockResolvedValue(MOCK_FAVORITE)
    mockPrisma.favorite.deleteMany.mockResolvedValue({ count: 1 })
  })

  it('elimina el favorito tipo actividad y retorna 200 con success:true', async () => {
    const req = makeRequest({}, 'activity')
    await DELETE(req as any, { params: Promise.resolve({ targetId: TARGET_ID_1 }) })

    expect(mockPrisma.favorite.deleteMany).toHaveBeenCalledWith({
      where: { userId: MOCK_DB_USER.id, activityId: TARGET_ID_1 },
    })
    expect(mockJson).toHaveBeenCalledWith({ success: true })
  })

  it('elimina el favorito tipo lugar y retorna 200 con success:true', async () => {
    const req = makeRequest({}, 'place')
    await DELETE(req as any, { params: Promise.resolve({ targetId: TARGET_ID_1 }) })

    expect(mockPrisma.favorite.deleteMany).toHaveBeenCalledWith({
      where: { userId: MOCK_DB_USER.id, locationId: TARGET_ID_1 },
    })
    expect(mockJson).toHaveBeenCalledWith({ success: true })
  })

  it('verifica que el favorito existe antes de eliminarlo', async () => {
    const req = makeRequest({}, 'activity')
    await DELETE(req as any, { params: Promise.resolve({ targetId: TARGET_ID_1 }) })

    expect(mockPrisma.favorite.findFirst).toHaveBeenCalledWith({
      where: { userId: MOCK_DB_USER.id, activityId: TARGET_ID_1 },
    })
  })

  it('retorna 404 si el favorito no existe', async () => {
    mockPrisma.favorite.findFirst.mockResolvedValue(null)
    const req = makeRequest({}, 'activity')

    await DELETE(req as any, { params: Promise.resolve({ targetId: 'id-no-favorito' }) })

    expect(mockPrisma.favorite.deleteMany).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledWith({ error: 'Favorito no encontrado' }, { status: 404 })
  })

  it('retorna 404 si el favorito no existe (usuario nuevo sin favoritos)', async () => {
    // Usuario recién creado por getOrCreateDbUser — no tiene favoritos
    mockGetOrCreateDbUser.mockResolvedValue({ id: 'new-user-000' })
    mockPrisma.favorite.findFirst.mockResolvedValue(null)
    const req = makeRequest({}, 'activity')

    await DELETE(req as any, { params: Promise.resolve({ targetId: TARGET_ID_1 }) })

    expect(mockPrisma.favorite.deleteMany).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledWith({ error: 'Favorito no encontrado' }, { status: 404 })
  })

  it('retorna 500 (auth wrapper) si no hay sesión autenticada', async () => {
    mockRequireAuth.mockRejectedValue(new Error('No auth'))
    const req = makeRequest({}, 'activity')

    await DELETE(req as any, { params: Promise.resolve({ targetId: TARGET_ID_1 }) })

    expect(mockPrisma.favorite.deleteMany).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledWith({ error: 'Error interno o no autorizado' }, { status: 500 })
  })

  it('usa el userId interno (resuelto por getOrCreateDbUser) para buscar el favorito', async () => {
    const req = makeRequest({}, 'activity')
    await DELETE(req as any, { params: Promise.resolve({ targetId: TARGET_ID_1 }) })

    expect(mockGetOrCreateDbUser).toHaveBeenCalledWith(MOCK_AUTH_USER)
    expect(mockPrisma.favorite.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: MOCK_DB_USER.id,
          activityId: TARGET_ID_1,
        },
      })
    )
  })

  it('retorna 400 si el type es inválido (no activity ni place)', async () => {
    const req = makeRequest({}, 'invalid_type')
    await DELETE(req as any, { params: Promise.resolve({ targetId: TARGET_ID_1 }) })

    expect(mockPrisma.favorite.deleteMany).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledWith({ error: 'Tipo inválido' }, { status: 400 })
  })

  it('no afecta favoritos de otros usuarios con el mismo targetId', async () => {
    const req = makeRequest({}, 'activity')
    await DELETE(req as any, { params: Promise.resolve({ targetId: TARGET_ID_1 }) })

    const deleteCall = mockPrisma.favorite.deleteMany.mock.calls[0][0]
    expect(deleteCall.where.userId).toBe(MOCK_DB_USER.id)
  })
})

// =============================================================================
// Verificación de aislamiento de usuarios (cross-user security)
// =============================================================================

describe('Seguridad: aislamiento entre usuarios', () => {
  it('GET solo devuelve favoritos del usuario autenticado, no de otros', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockGetOrCreateDbUser.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.favorite.findMany.mockResolvedValue([{ activityId: TARGET_ID_1 }])

    await GET()

    expect(mockPrisma.favorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: MOCK_DB_USER.id } })
    )
    expect(mockJson).toHaveBeenCalledWith({ favoriteIds: [TARGET_ID_1] })
  })

  it('DELETE no puede borrar favoritos de otro usuario', async () => {
    const OTRO_USER_DB = { id: 'otro-db-user-789' }
    mockRequireAuth.mockResolvedValue({ id: 'otro-auth-id' })
    mockGetOrCreateDbUser.mockResolvedValue(OTRO_USER_DB)
    mockPrisma.favorite.findFirst.mockResolvedValue(null)

    const req = makeRequest({}, 'activity')
    await DELETE(req as any, { params: Promise.resolve({ targetId: TARGET_ID_1 }) })

    expect(mockPrisma.favorite.deleteMany).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledWith({ error: 'Favorito no encontrado' }, { status: 404 })
  })
})
