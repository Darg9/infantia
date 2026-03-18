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
    child: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  }
  return { mockRequireAuth, mockPrisma }
})

vi.mock('@/lib/auth', () => ({ requireAuth: mockRequireAuth }))
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }))

import { NextResponse } from 'next/server'
import { GET, POST } from '../route'
import { DELETE } from '../[id]/route'

const mockJson = vi.mocked(NextResponse.json)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body?: object): Request {
  return {
    json: async () => body,
  } as unknown as Request
}

const MOCK_AUTH_USER = { id: 'auth-user-123' }
const MOCK_DB_USER = { id: 'db-user-456' }
const MOCK_CHILD = {
  id: 'child-789',
  userId: MOCK_DB_USER.id,
  name: 'Sofía',
  birthDate: new Date('2018-05-10'),
  gender: 'niña',
  interests: [],
  consentGivenAt: new Date(),
  createdAt: new Date(),
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/children', () => {
  it('retorna lista de hijos del usuario autenticado', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.child.findMany.mockResolvedValue([MOCK_CHILD])

    await GET()

    expect(mockJson).toHaveBeenCalledWith({ children: [MOCK_CHILD] })
  })

  it('retorna 404 si el usuario no existe en DB', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(null)

    await GET()

    expect(mockJson).toHaveBeenCalledWith({ error: 'Usuario no encontrado' }, { status: 404 })
  })

  it('retorna 401 si no hay sesión', async () => {
    mockRequireAuth.mockRejectedValue(new Error('No auth'))

    await GET()

    expect(mockJson).toHaveBeenCalledWith({ error: 'No autorizado' }, { status: 401 })
  })
})

describe('POST /api/children', () => {
  it('crea un hijo con todos los campos válidos', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.child.create.mockResolvedValue(MOCK_CHILD)

    const req = makeRequest({
      name: 'Sofía',
      birthDate: '2018-05-10',
      gender: 'niña',
      consentAccepted: true,
    })

    await POST(req as any)

    expect(mockPrisma.child.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: MOCK_DB_USER.id,
          name: 'Sofía',
          consentType: 'parental',
          consentGivenBy: MOCK_DB_USER.id,
        }),
      })
    )
    expect(mockJson).toHaveBeenCalledWith({ child: MOCK_CHILD }, { status: 201 })
  })

  it('retorna 400 si falta el nombre', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)

    const req = makeRequest({ birthDate: '2018-05-10', consentAccepted: true })
    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Nombre y fecha de nacimiento son obligatorios' },
      { status: 400 }
    )
  })

  it('retorna 400 si falta la fecha de nacimiento', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)

    const req = makeRequest({ name: 'Sofía', consentAccepted: true })
    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Nombre y fecha de nacimiento son obligatorios' },
      { status: 400 }
    )
  })

  it('retorna 400 si no se acepta el consentimiento', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)

    const req = makeRequest({ name: 'Sofía', birthDate: '2018-05-10', consentAccepted: false })
    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Debe aceptar la autorización de tratamiento de datos' },
      { status: 400 }
    )
  })

  it('retorna 400 si la fecha de nacimiento es inválida', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)

    const req = makeRequest({ name: 'Sofía', birthDate: 'no-es-fecha', consentAccepted: true })
    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith({ error: 'Fecha de nacimiento inválida' }, { status: 400 })
  })

  it('retorna 400 si el menor tiene más de 18 años', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)

    const req = makeRequest({ name: 'Juan', birthDate: '2000-01-01', consentAccepted: true })
    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Solo se pueden registrar perfiles de menores de edad' },
      { status: 400 }
    )
  })

  it('retorna 404 si el usuario no existe en DB', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const req = makeRequest({ name: 'Sofía', birthDate: '2018-05-10', consentAccepted: true })
    await POST(req as any)

    expect(mockJson).toHaveBeenCalledWith({ error: 'Usuario no encontrado' }, { status: 404 })
  })
})

describe('DELETE /api/children/[id]', () => {
  it('elimina el hijo si pertenece al usuario', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.child.findFirst.mockResolvedValue(MOCK_CHILD)
    mockPrisma.child.delete.mockResolvedValue(MOCK_CHILD)

    await DELETE({} as any, { params: Promise.resolve({ id: MOCK_CHILD.id }) })

    expect(mockPrisma.child.delete).toHaveBeenCalledWith({ where: { id: MOCK_CHILD.id } })
    expect(mockJson).toHaveBeenCalledWith({ ok: true })
  })

  it('retorna 404 si el hijo no pertenece al usuario', async () => {
    mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER)
    mockPrisma.child.findFirst.mockResolvedValue(null)

    await DELETE({} as any, { params: Promise.resolve({ id: 'otro-id' }) })

    expect(mockPrisma.child.delete).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledWith({ error: 'Perfil no encontrado' }, { status: 404 })
  })

  it('retorna 401 si no hay sesión', async () => {
    mockRequireAuth.mockRejectedValue(new Error('No auth'))

    await DELETE({} as any, { params: Promise.resolve({ id: 'cualquier-id' }) })

    expect(mockJson).toHaveBeenCalledWith({ error: 'No autorizado' }, { status: 401 })
  })
})
