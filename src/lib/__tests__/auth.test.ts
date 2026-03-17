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

// Import after mocks
import { getSession, getSessionWithRole, requireAuth, requireRole } from '../auth'

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
})
