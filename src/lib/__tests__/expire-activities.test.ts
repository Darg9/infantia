import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    activity: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    scrapingSource: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

import { expireActivities, DEFAULT_EXPIRATION_HOURS } from '../expire-activities'

// ── Fecha fija para todos los tests ──────────────────────────────────────────

const FIXED_NOW = new Date('2026-06-15T10:00:00.000Z')

// Helpers
function makeActivity(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Actividad ${id}`,
    type: 'ONE_TIME' as const,
    startDate: null as Date | null,
    endDate: null as Date | null,
    sourcePlatform: null,
    location: null,
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('expireActivities', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
    mockPrisma.activity.findMany.mockResolvedValue([])
    mockPrisma.activity.updateMany.mockResolvedValue({ count: 0 })
    mockPrisma.scrapingSource.findMany.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // ── Constante ────────────────────────────────────────────────────────────

  it('DEFAULT_EXPIRATION_HOURS es 48 (grace period)', () => {
    expect(DEFAULT_EXPIRATION_HOURS).toBe(48)
  })

  // ── Sin candidatas ───────────────────────────────────────────────────────

  it('devuelve { expired: 0, ids: [] } cuando no hay candidatas', async () => {
    const result = await expireActivities()
    expect(result).toEqual({ expired: 0, ids: [] })
  })

  it('no llama a updateMany cuando no hay candidatas', async () => {
    await expireActivities()
    expect(mockPrisma.activity.updateMany).not.toHaveBeenCalled()
  })

  // ── Expiración por endDate ───────────────────────────────────────────────

  it('expira actividades cuyo endDate ya pasó', async () => {
    const act = makeActivity('act-1', { endDate: new Date('2026-06-10T00:00:00.000Z') })
    mockPrisma.activity.findMany.mockResolvedValue([act])

    const result = await expireActivities()

    expect(result).toEqual({ expired: 1, ids: ['act-1'] })
  })

  it('llama a updateMany con los IDs correctos al expirar por endDate', async () => {
    const act = makeActivity('act-2', { endDate: new Date('2026-06-01T00:00:00.000Z') })
    mockPrisma.activity.findMany.mockResolvedValue([act])

    await expireActivities()

    expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['act-2'] } },
      data: { status: 'EXPIRED' },
    })
  })

  // ── Expiración por startDate + default 48h (grace period) ───────────────────

  it('expira actividades con startDate hace más de 48 horas y sin endDate (default)', async () => {
    // FIXED_NOW = 2026-06-15T10:00Z. 49h atrás = 2026-06-13T09:00Z → debe expirar
    const fortyNineHoursAgo = new Date('2026-06-13T09:00:00.000Z')
    const act = makeActivity('act-3', { startDate: fortyNineHoursAgo, endDate: null })
    mockPrisma.activity.findMany.mockResolvedValue([act])

    const result = await expireActivities()

    expect(result.expired).toBe(1)
    expect(result.ids).toContain('act-3')
  })

  it('NO expira actividades con startDate hace menos de 48 horas sin endDate', async () => {
    // FIXED_NOW = 2026-06-15T10:00Z. 24h atrás = 2026-06-14T10:00Z → dentro del grace period
    const twentyFourHoursAgo = new Date('2026-06-14T10:00:00.000Z')
    const act = makeActivity('act-4', { startDate: twentyFourHoursAgo, endDate: null })
    mockPrisma.activity.findMany.mockResolvedValue([act])

    const result = await expireActivities()

    expect(result.expired).toBe(0)
    expect(mockPrisma.activity.updateMany).not.toHaveBeenCalled()
  })

  // ── Configurable por lugar ───────────────────────────────────────────────

  it('usa expirationHoursAfterStart de Location si está configurado', async () => {
    // Location tiene 1 hora → startDate hace 2h → debe expirar
    const twoHoursAgo = new Date('2026-06-15T08:00:00.000Z')
    const act = makeActivity('act-5', {
      startDate: twoHoursAgo,
      endDate: null,
      location: { expirationHoursAfterStart: 1, cityId: 'city-1' },
    })
    mockPrisma.activity.findMany.mockResolvedValue([act])

    const result = await expireActivities()

    expect(result.expired).toBe(1)
    expect(result.ids).toContain('act-5')
  })

  it('NO expira si startDate está dentro del umbral configurado en Location', async () => {
    // Location tiene 6 horas → startDate hace 4h → NO debe expirar
    const fourHoursAgo = new Date('2026-06-15T06:00:00.000Z')
    const act = makeActivity('act-6', {
      startDate: fourHoursAgo,
      endDate: null,
      location: { expirationHoursAfterStart: 6, cityId: 'city-1' },
    })
    mockPrisma.activity.findMany.mockResolvedValue([act])

    const result = await expireActivities()

    expect(result.expired).toBe(0)
  })

  // ── Configurable por fuente (ScrapingSource) ─────────────────────────────

  it('usa config.expirationHoursAfterStart de ScrapingSource si Location no tiene config', async () => {
    // ScrapingSource tiene 1h → startDate hace 2h → debe expirar
    const twoHoursAgo = new Date('2026-06-15T08:00:00.000Z')
    const act = makeActivity('act-7', {
      startDate: twoHoursAgo,
      endDate: null,
      sourcePlatform: 'WEB',
      location: { expirationHoursAfterStart: null, cityId: 'city-2' },
    })
    mockPrisma.activity.findMany.mockResolvedValue([act])
    mockPrisma.scrapingSource.findMany.mockResolvedValue([
      { platform: 'WEB', cityId: 'city-2', config: { expirationHoursAfterStart: 1 } },
    ])

    const result = await expireActivities()

    expect(result.expired).toBe(1)
  })

  it('Location tiene prioridad sobre ScrapingSource', async () => {
    // Location: 6h, Source: 1h → startDate hace 2h → Location gana → NO expira
    const twoHoursAgo = new Date('2026-06-15T08:00:00.000Z')
    const act = makeActivity('act-8', {
      startDate: twoHoursAgo,
      endDate: null,
      sourcePlatform: 'WEB',
      location: { expirationHoursAfterStart: 6, cityId: 'city-3' },
    })
    mockPrisma.activity.findMany.mockResolvedValue([act])
    mockPrisma.scrapingSource.findMany.mockResolvedValue([
      { platform: 'WEB', cityId: 'city-3', config: { expirationHoursAfterStart: 1 } },
    ])

    const result = await expireActivities()

    expect(result.expired).toBe(0)
  })

  // ── Múltiples candidatas ─────────────────────────────────────────────────

  it('expira múltiples actividades en una sola llamada a updateMany', async () => {
    const acts = [
      makeActivity('act-a', { endDate: new Date('2026-06-01T00:00:00.000Z') }),
      makeActivity('act-b', { endDate: new Date('2026-05-20T00:00:00.000Z') }),
      // 49h atrás → supera grace period de 48h → debe expirar
      makeActivity('act-c', { startDate: new Date('2026-06-13T09:00:00.000Z'), endDate: null }),
    ]
    mockPrisma.activity.findMany.mockResolvedValue(acts)

    const result = await expireActivities()

    expect(result.expired).toBe(3)
    expect(result.ids).toEqual(['act-a', 'act-b', 'act-c'])
    expect(mockPrisma.activity.updateMany).toHaveBeenCalledOnce()
  })

  // ── Tipos de actividad expirables ─────────────────────────────────────────

  it.each([['ONE_TIME'], ['CAMP'], ['WORKSHOP']])(
    'expira correctamente actividades de tipo %s',
    async (type) => {
      const act = makeActivity('act-typed', {
        type,
        endDate: new Date('2026-06-01T00:00:00.000Z'),
      })
      mockPrisma.activity.findMany.mockResolvedValue([act])

      const result = await expireActivities()

      expect(result.expired).toBe(1)
    },
  )

  // ── Query a findMany ──────────────────────────────────────────────────────

  it('consulta findMany con status ACTIVE y solo tipos expirables', async () => {
    await expireActivities()

    const callArgs = mockPrisma.activity.findMany.mock.calls[0][0]

    expect(callArgs.where.status).toBe('ACTIVE')
    expect(callArgs.where.type).toEqual({ in: ['ONE_TIME', 'CAMP', 'WORKSHOP'] })
  })

  it('el query incluye select con location y sourcePlatform', async () => {
    await expireActivities()

    const callArgs = mockPrisma.activity.findMany.mock.calls[0][0]

    expect(callArgs.select).toMatchObject({
      id: true,
      startDate: true,
      endDate: true,
      sourcePlatform: true,
      location: expect.objectContaining({ select: expect.any(Object) }),
    })
  })

  // ── Interfaz de retorno ───────────────────────────────────────────────────

  it('devuelve exactamente los IDs de las actividades expiradas', async () => {
    const acts = [makeActivity('id-x'), makeActivity('id-y')]
    acts[0] = { ...acts[0], endDate: new Date('2026-06-01T00:00:00.000Z') }
    acts[1] = { ...acts[1], endDate: new Date('2026-05-01T00:00:00.000Z') }
    mockPrisma.activity.findMany.mockResolvedValue(acts)

    const result = await expireActivities()

    expect(result.ids).toEqual(['id-x', 'id-y'])
    expect(result.expired).toBe(result.ids.length)
  })

  it('el resultado tiene la forma correcta de ExpireResult', async () => {
    mockPrisma.activity.findMany.mockResolvedValue([
      makeActivity('act-z', { endDate: new Date('2026-06-01T00:00:00.000Z') }),
    ])

    const result = await expireActivities()

    expect(result).toHaveProperty('expired')
    expect(result).toHaveProperty('ids')
    expect(typeof result.expired).toBe('number')
    expect(Array.isArray(result.ids)).toBe(true)
  })
})
