import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init?) => ({ _data: data, _status: init?.status ?? 200 })),
  },
}))

const { mockRequireAuth, mockPrisma, mockSupabase } = vi.hoisted(() => {
  const mockRequireAuth = vi.fn()
  const mockPrisma = {
    user: { update: vi.fn() },
  }
  const mockSupabase = {
    auth: { updateUser: vi.fn().mockResolvedValue({}) },
  }
  return { mockRequireAuth, mockPrisma, mockSupabase }
})

vi.mock('@/lib/auth', () => ({ requireAuth: mockRequireAuth }))
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => mockSupabase),
}))

import { NextResponse } from 'next/server'
import { PUT } from '../route'

const mockJson = vi.mocked(NextResponse.json)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body?: object): Request {
  return {
    json: async () => body,
  } as unknown as Request
}

const MOCK_AUTH_USER = { id: 'auth-user-123' }

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAuth.mockResolvedValue(MOCK_AUTH_USER)
  mockPrisma.user.update.mockResolvedValue({ id: 'db-1', name: 'Denys' })
  mockSupabase.auth.updateUser.mockResolvedValue({})
})

describe('PUT /api/profile', () => {
  it('updates name successfully', async () => {
    await PUT(makeRequest({ name: 'Denys' }) as any)

    expect(mockJson).toHaveBeenCalledWith({ success: true, name: 'Denys' })
  })

  it('returns 400 when name is missing', async () => {
    await PUT(makeRequest({}) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Nombre requerido' },
      { status: 400 },
    )
  })

  it('returns 400 when name is empty string', async () => {
    await PUT(makeRequest({ name: '' }) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Nombre requerido' },
      { status: 400 },
    )
  })

  it('returns 400 when name is not a string', async () => {
    await PUT(makeRequest({ name: 42 }) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Nombre requerido' },
      { status: 400 },
    )
  })

  it('returns 400 when name exceeds 100 characters', async () => {
    const longName = 'A'.repeat(101)
    await PUT(makeRequest({ name: longName }) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Nombre demasiado largo (max 100 caracteres)' },
      { status: 400 },
    )
  })

  it('returns 500 when user is not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('No autenticado'))

    await PUT(makeRequest({ name: 'Denys' }) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Error al actualizar perfil' },
      { status: 500 },
    )
  })

  it('returns 500 when prisma update fails', async () => {
    mockPrisma.user.update.mockRejectedValue(new Error('DB error'))

    await PUT(makeRequest({ name: 'Denys' }) as any)

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Error al actualizar perfil' },
      { status: 500 },
    )
  })

  it('trims the name before saving', async () => {
    await PUT(makeRequest({ name: '  Denys Reyes  ' }) as any)

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { supabaseAuthId: MOCK_AUTH_USER.id },
      data: { name: 'Denys Reyes' },
    })
    expect(mockJson).toHaveBeenCalledWith({ success: true, name: 'Denys Reyes' })
  })

  it('calls both prisma.user.update and supabase.auth.updateUser', async () => {
    await PUT(makeRequest({ name: 'Denys' }) as any)

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { supabaseAuthId: MOCK_AUTH_USER.id },
      data: { name: 'Denys' },
    })
    expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
      data: { name: 'Denys' },
    })
  })
})
