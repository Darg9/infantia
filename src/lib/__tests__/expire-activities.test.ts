import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock de prisma ────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    activity: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

import { expireActivities } from '../expire-activities'

// ── Fecha fija para todos los tests ──────────────────────────────────────────

const FIXED_NOW = new Date('2026-06-15T10:00:00.000Z')

// Helpers para construir actividades de prueba
function makeActivity(id: string, overrides = {}) {
  return {
    id,
    title: `Actividad ${id}`,
    type: 'ONE_TIME' as const,
    startDate: null,
    endDate: null,
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
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // ── Caso: sin candidatas ────────────────────────────────────────────────────

  it('devuelve { expired: 0, ids: [] } cuando no hay candidatas', async () => {
    mockPrisma.activity.findMany.mockResolvedValue([])

    const result = await expireActivities()

    expect(result).toEqual({ expired: 0, ids: [] })
  })

  it('no llama a updateMany cuando no hay candidatas', async () => {
    mockPrisma.activity.findMany.mockResolvedValue([])

    await expireActivities()

    expect(mockPrisma.activity.updateMany).not.toHaveBeenCalled()
  })

  // ── Caso: candidatas con endDate pasado ────────────────────────────────────

  it('expira actividades cuyo endDate ya pasó', async () => {
    const past = new Date('2026-06-10T00:00:00.000Z') // 5 días antes de FIXED_NOW
    const act = makeActivity('act-1', { endDate: past })
    mockPrisma.activity.findMany.mockResolvedValue([act])

    const result = await expireActivities()

    expect(result).toEqual({ expired: 1, ids: ['act-1'] })
  })

  it('llama a updateMany con los IDs correctos cuando expira por endDate', async () => {
    const act = makeActivity('act-2', { endDate: new Date('2026-06-01T00:00:00.000Z') })
    mockPrisma.activity.findMany.mockResolvedValue([act])

    await expireActivities()

    expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['act-2'] } },
      data: { status: 'EXPIRED' },
    })
  })

  // ── Caso: candidatas con startDate >3 días atrás sin endDate ───────────────

  it('expira actividades con startDate hace más de 3 días y sin endDate', async () => {
    const fourDaysAgo = new Date('2026-06-11T00:00:00.000Z') // 4 días antes
    const act = makeActivity('act-3', { startDate: fourDaysAgo, endDate: null })
    mockPrisma.activity.findMany.mockResolvedValue([act])

    const result = await expireActivities()

    expect(result.expired).toBe(1)
    expect(result.ids).toContain('act-3')
  })

  // ── Caso: múltiples candidatas ────────────────────────────────────────────

  it('expira múltiples actividades en una sola llamada', async () => {
    const acts = [
      makeActivity('act-a', { endDate: new Date('2026-06-01T00:00:00.000Z') }),
      makeActivity('act-b', { endDate: new Date('2026-05-20T00:00:00.000Z') }),
      makeActivity('act-c', { startDate: new Date('2026-06-10T00:00:00.000Z'), endDate: null }),
    ]
    mockPrisma.activity.findMany.mockResolvedValue(acts)

    const result = await expireActivities()

    expect(result.expired).toBe(3)
    expect(result.ids).toEqual(['act-a', 'act-b', 'act-c'])
    expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['act-a', 'act-b', 'act-c'] } },
      data: { status: 'EXPIRED' },
    })
  })

  // ── Verificación del query a findMany ──────────────────────────────────────

  it('consulta findMany con status ACTIVE y solo tipos expirables', async () => {
    await expireActivities()

    const callArgs = mockPrisma.activity.findMany.mock.calls[0][0]

    expect(callArgs.where.status).toBe('ACTIVE')
    expect(callArgs.where.type).toEqual({ in: ['ONE_TIME', 'CAMP', 'WORKSHOP'] })
  })

  it('el query incluye condición OR para endDate y startDate', async () => {
    await expireActivities()

    const callArgs = mockPrisma.activity.findMany.mock.calls[0][0]
    const orConditions = callArgs.where.OR

    expect(orConditions).toHaveLength(2)
    // Primera condición: endDate < now
    expect(orConditions[0]).toHaveProperty('endDate')
    // Segunda condición: startDate < threeDaysAgo y endDate null
    expect(orConditions[1]).toHaveProperty('startDate')
    expect(orConditions[1].endDate).toBeNull()
  })

  it('el umbral de threeDaysAgo es exactamente 3 días antes de now', async () => {
    await expireActivities()

    const callArgs = mockPrisma.activity.findMany.mock.calls[0][0]
    const threeDaysAgo = callArgs.where.OR[1].startDate.lt as Date

    const expectedThreeDaysAgo = new Date(FIXED_NOW)
    expectedThreeDaysAgo.setDate(expectedThreeDaysAgo.getDate() - 3)

    expect(threeDaysAgo.getTime()).toBe(expectedThreeDaysAgo.getTime())
  })

  it('el query incluye select con los campos necesarios', async () => {
    await expireActivities()

    const callArgs = mockPrisma.activity.findMany.mock.calls[0][0]

    expect(callArgs.select).toEqual({
      id: true,
      title: true,
      type: true,
      startDate: true,
      endDate: true,
    })
  })

  // ── RECURRING no expira ───────────────────────────────────────────────────

  it('no incluye RECURRING en los tipos expirables del query', async () => {
    await expireActivities()

    const callArgs = mockPrisma.activity.findMany.mock.calls[0][0]
    const types: string[] = callArgs.where.type.in

    expect(types).not.toContain('RECURRING')
  })

  // ── Tipos de actividad expirables ─────────────────────────────────────────

  it.each([
    ['ONE_TIME'],
    ['CAMP'],
    ['WORKSHOP'],
  ])('expira correctamente actividades de tipo %s', async (type) => {
    const act = makeActivity('act-typed', {
      type,
      endDate: new Date('2026-06-01T00:00:00.000Z'),
    })
    mockPrisma.activity.findMany.mockResolvedValue([act])

    const result = await expireActivities()

    expect(result.expired).toBe(1)
  })

  // ── Interfaz de retorno ───────────────────────────────────────────────────

  it('devuelve exactamente los IDs de las actividades expiradas', async () => {
    const acts = [
      makeActivity('id-x'),
      makeActivity('id-y'),
    ]
    mockPrisma.activity.findMany.mockResolvedValue(acts)

    const result = await expireActivities()

    expect(result.ids).toEqual(['id-x', 'id-y'])
    expect(result.expired).toBe(result.ids.length)
  })

  it('el resultado tiene la forma correcta de ExpireResult', async () => {
    mockPrisma.activity.findMany.mockResolvedValue([makeActivity('act-z')])

    const result = await expireActivities()

    expect(result).toHaveProperty('expired')
    expect(result).toHaveProperty('ids')
    expect(typeof result.expired).toBe('number')
    expect(Array.isArray(result.ids)).toBe(true)
  })
})
