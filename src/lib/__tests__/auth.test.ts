import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de next/navigation
const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args)
    throw new Error('NEXT_REDIRECT')
  },
}))

// Mock de supabase server client
const mockGetUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
  }),
}))

// Mock de prisma para getOrCreateDbUser
const { mockUpsert } = vi.hoisted(() => ({
  mockUpsert: vi.fn().mockResolvedValue({ id: 'db-user-1', name: 'Test User' }),
}))
vi.mock('@/lib/db', () => ({
  prisma: { user: { upsert: mockUpsert } },
}))

// Import after mocks
import { getSession, getSessionWithRole, requireAuth, requireRole, getOrCreateDbUser } from '../auth'

describe('auth utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── getSession ──

  describe('getSession()', () => {
    it('retorna el usuario si esta autenticado', async () => {
      const user = { id: 'u1', email: 'test@test.com' }
      mockGetUser.mockResolvedValue({ data: { user } })

      const result = await getSession()
      expect(result).toEqual(user)
    })

    it('retorna null si no hay usuario', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const result = await getSession()
      expect(result).toBeNull()
    })
  })

  // ── getSessionWithRole ──

  describe('getSessionWithRole()', () => {
    it('retorna usuario con rol de app_metadata', async () => {
      const user = { id: 'u1', email: 'a@b.com', app_metadata: { role: 'admin' } }
      mockGetUser.mockResolvedValue({ data: { user } })

      const result = await getSessionWithRole()
      expect(result).toEqual({ user, role: 'admin' })
    })

    it('retorna role "parent" por defecto si no hay app_metadata.role', async () => {
      const user = { id: 'u2', email: 'b@b.com', app_metadata: {} }
      mockGetUser.mockResolvedValue({ data: { user } })

      const result = await getSessionWithRole()
      expect(result?.role).toBe('parent')
    })

    it('retorna role "parent" si app_metadata es undefined', async () => {
      const user = { id: 'u3', email: 'c@c.com' }
      mockGetUser.mockResolvedValue({ data: { user } })

      const result = await getSessionWithRole()
      expect(result?.role).toBe('parent')
    })

    it('retorna null si no hay usuario', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const result = await getSessionWithRole()
      expect(result).toBeNull()
    })
  })

  // ── requireAuth ──

  describe('requireAuth()', () => {
    it('retorna usuario si esta autenticado', async () => {
      const user = { id: 'u1', email: 'test@test.com' }
      mockGetUser.mockResolvedValue({ data: { user } })

      const result = await requireAuth()
      expect(result).toEqual(user)
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('redirige a /login si no hay sesion', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      await expect(requireAuth()).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/login')
    })
  })

  // ── requireRole ──

  describe('requireRole()', () => {
    it('retorna sesion si el usuario tiene el rol requerido (ADMIN)', async () => {
      const user = { id: 'u1', email: 'admin@test.com', app_metadata: { role: 'admin' } }
      mockGetUser.mockResolvedValue({ data: { user } })

      const result = await requireRole(['ADMIN'])
      expect(result).toEqual({ user, role: 'admin' })
    })

    it('redirige a / si el usuario no tiene el rol requerido', async () => {
      const user = { id: 'u2', email: 'user@test.com', app_metadata: { role: 'parent' } }
      mockGetUser.mockResolvedValue({ data: { user } })

      await expect(requireRole(['ADMIN'])).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/')
    })

    it('redirige a /login si no hay sesion', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      await expect(requireRole(['ADMIN'])).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/login')
    })

    it('acepta multiples roles (ADMIN o MODERATOR)', async () => {
      const user = { id: 'u3', email: 'mod@test.com', app_metadata: { role: 'moderator' } }
      mockGetUser.mockResolvedValue({ data: { user } })

      const result = await requireRole(['ADMIN', 'MODERATOR'])
      expect(result).toEqual({ user, role: 'moderator' })
    })

    it('rol desconocido se trata como PARENT', async () => {
      const user = { id: 'u4', email: 'x@test.com', app_metadata: { role: 'superuser' } }
      mockGetUser.mockResolvedValue({ data: { user } })

      // Si pide ADMIN, un rol desconocido (mapeado a PARENT) no pasa
      await expect(requireRole(['ADMIN'])).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/')
    })

    it('rol desconocido pasa si PARENT esta en los roles permitidos', async () => {
      const user = { id: 'u5', email: 'y@test.com', app_metadata: { role: 'unknown' } }
      mockGetUser.mockResolvedValue({ data: { user } })

      const result = await requireRole(['PARENT'])
      expect(result).toEqual({ user, role: 'unknown' })
    })
  })

  // ── getOrCreateDbUser ──

  describe('getOrCreateDbUser()', () => {
    beforeEach(() => mockUpsert.mockResolvedValue({ id: 'db-1', name: 'Test' }))

    it('usa full_name de user_metadata cuando está disponible', async () => {
      const authUser = {
        id: 'auth-1',
        email: 'a@b.com',
        user_metadata: { full_name: 'Juan Pérez', name: 'Juan' },
      } as any

      await getOrCreateDbUser(authUser)

      const createArg = mockUpsert.mock.calls[0][0].create
      expect(createArg.name).toBe('Juan Pérez')
    })

    it('usa user_metadata.name si no hay full_name', async () => {
      const authUser = {
        id: 'auth-2',
        email: 'b@c.com',
        user_metadata: { name: 'María' },
      } as any

      await getOrCreateDbUser(authUser)

      const createArg = mockUpsert.mock.calls[0][0].create
      expect(createArg.name).toBe('María')
    })

    it('usa la parte local del email si no hay user_metadata.name', async () => {
      const authUser = {
        id: 'auth-3',
        email: 'carlos@example.com',
        user_metadata: {},
      } as any

      await getOrCreateDbUser(authUser)

      const createArg = mockUpsert.mock.calls[0][0].create
      expect(createArg.name).toBe('carlos')
    })

    it('usa "Usuario" como fallback si no hay ningún dato de nombre', async () => {
      const authUser = {
        id: 'auth-4',
        email: undefined,
        user_metadata: {},
      } as any

      await getOrCreateDbUser(authUser)

      const createArg = mockUpsert.mock.calls[0][0].create
      expect(createArg.name).toBe('Usuario')
    })

    it('llama upsert con supabaseAuthId correcto y rol PARENT', async () => {
      const authUser = {
        id: 'auth-5',
        email: 'x@y.com',
        user_metadata: { full_name: 'Test' },
      } as any

      await getOrCreateDbUser(authUser)

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { supabaseAuthId: 'auth-5' },
          create: expect.objectContaining({ role: 'PARENT', supabaseAuthId: 'auth-5' }),
        })
      )
    })
  })
})
