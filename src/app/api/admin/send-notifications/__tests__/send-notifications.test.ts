import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init?) => ({ _data: data, _status: init?.status ?? 200 })),
  },
}))

const { mockPrisma, mockSendActivityDigest, mockSendPushToMany } = vi.hoisted(() => {
  const mockPrisma = {
    user: { findMany: vi.fn() },
    child: { findMany: vi.fn() },
    activity: { findMany: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    pushSubscription: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({}) },
    $disconnect: vi.fn().mockResolvedValue(undefined),
  }
  const mockSendActivityDigest = vi.fn()
  const mockSendPushToMany = vi.fn().mockResolvedValue([])
  return { mockPrisma, mockSendActivityDigest, mockSendPushToMany }
})

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class PrismaPg {
    constructor(_options: unknown) {}
  },
}))

vi.mock('@/generated/prisma/client', () => ({
  // eslint-disable-next-line prefer-arrow-callback
  PrismaClient: function PrismaClient() { return mockPrisma; },
}))

vi.mock('@/lib/email/resend', () => ({
  sendWelcomeEmail: vi.fn(),
  sendActivityDigest: mockSendActivityDigest,
}))

vi.mock('@/lib/push', () => ({
  sendPushToMany: mockSendPushToMany,
}))

import { NextResponse } from 'next/server'
import { POST } from '../route'

const mockJson = vi.mocked(NextResponse.json)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(options?: {
  authHeader?: string
  period?: string
  dryRun?: string
}): any {
  const params = new URLSearchParams()
  if (options?.period) params.set('period', options.period)
  if (options?.dryRun) params.set('dryRun', options.dryRun)

  return {
    headers: {
      get: (key: string) => {
        if (key === 'authorization') return options?.authHeader ?? null
        return null
      },
    },
    nextUrl: {
      searchParams: params,
    },
  }
}

const VALID_AUTH = 'Bearer test-secret'

const USER_DAILY = {
  id: 'user-1',
  email: 'daily@example.com',
  name: 'Usuario Daily',
  notificationPrefs: {
    email: true,
    frequency: 'daily',
    categories: { newActivities: true },
  },
}

const USER_WEEKLY = {
  id: 'user-2',
  email: 'weekly@example.com',
  name: 'Usuario Weekly',
  notificationPrefs: {
    email: true,
    frequency: 'weekly',
    categories: { newActivities: true },
  },
}

const USER_NO_EMAIL = {
  id: 'user-3',
  email: 'noemail@example.com',
  name: 'Sin Email',
  notificationPrefs: {
    email: false,
    frequency: 'daily',
    categories: { newActivities: true },
  },
}

const USER_NO_ACTIVITIES_PREF = {
  id: 'user-4',
  email: 'noact@example.com',
  name: 'Sin Actividades',
  notificationPrefs: {
    email: true,
    frequency: 'daily',
    categories: { newActivities: false },
  },
}

const SAMPLE_ACTIVITIES = [
  {
    id: 'act-1',
    title: 'Taller de arte',
    description: 'Descripción',
    price: null,
    ageMin: 5,
    ageMax: 12,
  },
]

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
  mockPrisma.child.findMany.mockResolvedValue([])
  mockPrisma.activity.findMany.mockResolvedValue([])
  mockPrisma.activity.count.mockResolvedValue(0)
  mockPrisma.pushSubscription.findMany.mockResolvedValue([])
  mockPrisma.pushSubscription.deleteMany.mockResolvedValue({})
  mockSendPushToMany.mockResolvedValue([])
})

describe('POST /api/admin/send-notifications', () => {
  describe('Autenticación', () => {
    it('retorna 401 si no hay header de autorización', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      const req = makeRequest({ authHeader: undefined })
      await POST(req)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Unauthorized' }, { status: 401 })
    })

    it('retorna 401 si el Bearer token es incorrecto', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      const req = makeRequest({ authHeader: 'Bearer wrong-secret' })
      await POST(req)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Unauthorized' }, { status: 401 })
    })

    it('acepta una petición con el token correcto', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      const req = makeRequest({ authHeader: VALID_AUTH })
      await POST(req)
      const call = mockJson.mock.calls[0]
      expect(call[1]?.status ?? 200).not.toBe(401)
    })
  })

  describe('Parámetros y respuesta base', () => {
    it('retorna success:true con sin usuarios', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      const req = makeRequest({ authHeader: VALID_AUTH })
      await POST(req)
      const data = mockJson.mock.calls[0][0] as any
      expect(data.success).toBe(true)
      expect(data.total).toBe(0)
      expect(data.sent).toBe(0)
      expect(data.skipped).toBe(0)
    })

    it('incluye dryRun:false por defecto', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      const req = makeRequest({ authHeader: VALID_AUTH })
      await POST(req)
      const data = mockJson.mock.calls[0][0] as any
      expect(data.dryRun).toBe(false)
    })

    it('incluye dryRun:true cuando se pasa como parámetro', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      const req = makeRequest({ authHeader: VALID_AUTH, dryRun: 'true' })
      await POST(req)
      const data = mockJson.mock.calls[0][0] as any
      expect(data.dryRun).toBe(true)
    })

    it('llama a $disconnect al finalizar', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      const req = makeRequest({ authHeader: VALID_AUTH })
      await POST(req)
      expect(mockPrisma.$disconnect).toHaveBeenCalled()
    })
  })

  describe('Filtrado de usuarios', () => {
    it('omite usuarios con email deshabilitado', async () => {
      mockPrisma.user.findMany.mockResolvedValue([USER_NO_EMAIL])
      const req = makeRequest({ authHeader: VALID_AUTH })
      await POST(req)
      const data = mockJson.mock.calls[0][0] as any
      expect(data.skipped).toBe(1)
      expect(data.sent).toBe(0)
    })

    it('omite usuarios sin la categoría newActivities habilitada', async () => {
      mockPrisma.user.findMany.mockResolvedValue([USER_NO_ACTIVITIES_PREF])
      const req = makeRequest({ authHeader: VALID_AUTH })
      await POST(req)
      const data = mockJson.mock.calls[0][0] as any
      expect(data.skipped).toBe(1)
      expect(data.sent).toBe(0)
    })

    it('omite usuarios con frecuencia weekly en período daily', async () => {
      mockPrisma.user.findMany.mockResolvedValue([USER_WEEKLY])
      const req = makeRequest({ authHeader: VALID_AUTH, period: 'daily' })
      await POST(req)
      const data = mockJson.mock.calls[0][0] as any
      expect(data.skipped).toBe(1)
      expect(data.sent).toBe(0)
    })

    it('procesa usuarios con frecuencia daily en período daily', async () => {
      mockPrisma.user.findMany.mockResolvedValue([USER_DAILY])
      mockPrisma.activity.findMany.mockResolvedValue(SAMPLE_ACTIVITIES)
      mockSendActivityDigest.mockResolvedValue({ success: true })
      const req = makeRequest({ authHeader: VALID_AUTH, period: 'daily' })
      await POST(req)
      const data = mockJson.mock.calls[0][0] as any
      expect(data.sent).toBe(1)
    })

    it('omite usuario si no hay actividades recientes', async () => {
      mockPrisma.user.findMany.mockResolvedValue([USER_DAILY])
      mockPrisma.activity.findMany.mockResolvedValue([])
      const req = makeRequest({ authHeader: VALID_AUTH })
      await POST(req)
      const data = mockJson.mock.calls[0][0] as any
      expect(data.skipped).toBe(1)
      expect(data.sent).toBe(0)
    })

    it('procesa usuarios weekly en período weekly', async () => {
      mockPrisma.user.findMany.mockResolvedValue([USER_WEEKLY])
      mockPrisma.activity.findMany.mockResolvedValue(SAMPLE_ACTIVITIES)
      mockSendActivityDigest.mockResolvedValue({ success: true })
      const req = makeRequest({ authHeader: VALID_AUTH, period: 'weekly' })
      await POST(req)
      const data = mockJson.mock.calls[0][0] as any
      expect(data.sent).toBe(1)
    })
  })

  describe('Modo dryRun', () => {
    it('no llama sendActivityDigest en modo dryRun', async () => {
      mockPrisma.user.findMany.mockResolvedValue([USER_DAILY])
      mockPrisma.activity.findMany.mockResolvedValue(SAMPLE_ACTIVITIES)
      const req = makeRequest({ authHeader: VALID_AUTH, dryRun: 'true' })
      await POST(req)
      expect(mockSendActivityDigest).not.toHaveBeenCalled()
    })

    it('incrementa sentCount en modo dryRun (como si se enviara)', async () => {
      mockPrisma.user.findMany.mockResolvedValue([USER_DAILY])
      mockPrisma.activity.findMany.mockResolvedValue(SAMPLE_ACTIVITIES)
      const req = makeRequest({ authHeader: VALID_AUTH, dryRun: 'true' })
      await POST(req)
      const data = mockJson.mock.calls[0][0] as any
      expect(data.sent).toBe(1)
    })
  })

  describe('Envío real', () => {
    it('llama sendActivityDigest con los parámetros correctos', async () => {
      mockPrisma.user.findMany.mockResolvedValue([USER_DAILY])
      mockPrisma.activity.findMany.mockResolvedValue(SAMPLE_ACTIVITIES)
      mockSendActivityDigest.mockResolvedValue({ success: true })
      const req = makeRequest({ authHeader: VALID_AUTH })
      await POST(req)
      expect(mockSendActivityDigest).toHaveBeenCalledWith(
        expect.objectContaining({
          to: USER_DAILY.email,
          userName: USER_DAILY.name,
          period: 'daily',
        })
      )
    })

    it('registra error si sendActivityDigest falla', async () => {
      mockPrisma.user.findMany.mockResolvedValue([USER_DAILY])
      mockPrisma.activity.findMany.mockResolvedValue(SAMPLE_ACTIVITIES)
      mockSendActivityDigest.mockResolvedValue({ success: false, error: 'SMTP error' })
      const req = makeRequest({ authHeader: VALID_AUTH })
      await POST(req)
      const data = mockJson.mock.calls[0][0] as any
      expect(data.errors).toBe(1)
      expect(data.sent).toBe(0)
    })
  })

  describe('Manejo de errores', () => {
    it('retorna 500 si prisma.user.findMany lanza una excepción', async () => {
      mockPrisma.user.findMany.mockRejectedValue(new Error('DB connection failed'))
      const req = makeRequest({ authHeader: VALID_AUTH })
      await POST(req)
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
        { status: 500 }
      )
    })

    it('llama $disconnect incluso tras un error catastrófico', async () => {
      mockPrisma.user.findMany.mockRejectedValue(new Error('DB down'))
      const req = makeRequest({ authHeader: VALID_AUTH })
      await POST(req)
      expect(mockPrisma.$disconnect).toHaveBeenCalled()
    })

    it('captura error de usuario individual sin detener el resto', async () => {
      const USER_THROWS = {
        id: 'user-throws',
        email: 'throws@example.com',
        name: 'Throws',
        notificationPrefs: {
          email: true,
          frequency: 'daily',
          categories: { newActivities: true },
        },
      }
      mockPrisma.user.findMany.mockResolvedValue([USER_THROWS, USER_DAILY])
      mockPrisma.activity.findMany
        .mockRejectedValueOnce(new Error('Query failed'))
        .mockResolvedValueOnce(SAMPLE_ACTIVITIES)
      mockSendActivityDigest.mockResolvedValue({ success: true })
      const req = makeRequest({ authHeader: VALID_AUTH })
      await POST(req)
      const data = mockJson.mock.calls[0][0] as any
      expect(data.errors).toBe(1)
      expect(data.sent).toBe(1)
    })
  })

  describe('Múltiples usuarios', () => {
    it('procesa múltiples usuarios correctamente', async () => {
      mockPrisma.user.findMany.mockResolvedValue([USER_DAILY, USER_NO_EMAIL, USER_NO_ACTIVITIES_PREF])
      mockPrisma.activity.findMany.mockResolvedValue(SAMPLE_ACTIVITIES)
      mockSendActivityDigest.mockResolvedValue({ success: true })
      const req = makeRequest({ authHeader: VALID_AUTH })
      await POST(req)
      const data = mockJson.mock.calls[0][0] as any
      expect(data.total).toBe(3)
      expect(data.sent).toBe(1)
      expect(data.skipped).toBe(2)
    })
  })
})
