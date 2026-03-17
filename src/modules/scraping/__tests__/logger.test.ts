import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fns must use vi.hoisted to be available in vi.mock factories
const { mockLogCreate, mockLogUpdate, mockSourceUpdate, mockSourceFindFirst, mockSourceCreate } =
  vi.hoisted(() => ({
    mockLogCreate: vi.fn(),
    mockLogUpdate: vi.fn(),
    mockSourceUpdate: vi.fn(),
    mockSourceFindFirst: vi.fn(),
    mockSourceCreate: vi.fn(),
  }))

vi.mock('dotenv/config', () => ({}))
vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class MockPrismaPg {},
}))
vi.mock('../../../generated/prisma/client', () => ({
  PrismaClient: class MockPrismaClient {
    scrapingLog = {
      create: mockLogCreate,
      update: mockLogUpdate,
    }
    scrapingSource = {
      update: mockSourceUpdate,
      findFirst: mockSourceFindFirst,
      create: mockSourceCreate,
    }
  },
  ScrapingStatus: {
    RUNNING: 'RUNNING',
    SUCCESS: 'SUCCESS',
    PARTIAL: 'PARTIAL',
    FAILED: 'FAILED',
  },
}))

import { ScrapingLogger, type RunStats } from '../logger'

describe('ScrapingLogger', () => {
  let logger: ScrapingLogger

  beforeEach(() => {
    vi.clearAllMocks()
    logger = new ScrapingLogger()
  })

  // ── startRun ──

  describe('startRun()', () => {
    it('crea un log con status RUNNING y retorna el id', async () => {
      mockLogCreate.mockResolvedValue({ id: 'log-1' })

      const logId = await logger.startRun('source-1')

      expect(logId).toBe('log-1')
      expect(mockLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sourceId: 'source-1',
          status: 'RUNNING',
        }),
      })
    })
  })

  // ── completeRun ──

  describe('completeRun()', () => {
    it('marca SUCCESS cuando no hay error', async () => {
      mockLogUpdate.mockResolvedValue({})
      const stats: RunStats = {
        itemsFound: 10,
        itemsNew: 5,
        itemsUpdated: 3,
        itemsDuplicated: 2,
      }

      await logger.completeRun('log-1', stats)

      expect(mockLogUpdate).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: expect.objectContaining({
          status: 'SUCCESS',
          itemsFound: 10,
          itemsNew: 5,
          itemsUpdated: 3,
          itemsDuplicated: 2,
          errorMessage: null,
        }),
      })
    })

    it('marca FAILED cuando hay error y 0 items encontrados', async () => {
      mockLogUpdate.mockResolvedValue({})
      const stats: RunStats = {
        itemsFound: 0,
        itemsNew: 0,
        itemsUpdated: 0,
        itemsDuplicated: 0,
        errorMessage: 'Connection refused',
      }

      await logger.completeRun('log-2', stats)

      const call = mockLogUpdate.mock.calls[0][0]
      expect(call.data.status).toBe('FAILED')
      expect(call.data.errorMessage).toBe('Connection refused')
    })

    it('marca PARTIAL cuando hay error pero tambien items encontrados', async () => {
      mockLogUpdate.mockResolvedValue({})
      const stats: RunStats = {
        itemsFound: 5,
        itemsNew: 3,
        itemsUpdated: 0,
        itemsDuplicated: 2,
        errorMessage: '2 URLs fallaron',
      }

      await logger.completeRun('log-3', stats)

      const call = mockLogUpdate.mock.calls[0][0]
      expect(call.data.status).toBe('PARTIAL')
      expect(call.data.errorMessage).toBe('2 URLs fallaron')
    })

    it('incluye metadata cuando se proporciona', async () => {
      mockLogUpdate.mockResolvedValue({})
      const stats: RunStats = {
        itemsFound: 10,
        itemsNew: 10,
        itemsUpdated: 0,
        itemsDuplicated: 0,
        metadata: { discoveredLinks: 50, cached: 5 },
      }

      await logger.completeRun('log-4', stats)

      const call = mockLogUpdate.mock.calls[0][0]
      expect(call.data.metadata).toEqual({ discoveredLinks: 50, cached: 5 })
    })

    it('incluye finishedAt como Date', async () => {
      mockLogUpdate.mockResolvedValue({})
      const stats: RunStats = { itemsFound: 1, itemsNew: 1, itemsUpdated: 0, itemsDuplicated: 0 }

      await logger.completeRun('log-5', stats)

      const call = mockLogUpdate.mock.calls[0][0]
      expect(call.data.finishedAt).toBeInstanceOf(Date)
    })
  })

  // ── updateSourceStatus ──

  describe('updateSourceStatus()', () => {
    it('actualiza lastRunAt, lastRunStatus y lastRunItems', async () => {
      mockSourceUpdate.mockResolvedValue({})

      await logger.updateSourceStatus('source-1', 'SUCCESS' as any, 25)

      expect(mockSourceUpdate).toHaveBeenCalledWith({
        where: { id: 'source-1' },
        data: expect.objectContaining({
          lastRunStatus: 'SUCCESS',
          lastRunItems: 25,
        }),
      })
      const call = mockSourceUpdate.mock.calls[0][0]
      expect(call.data.lastRunAt).toBeInstanceOf(Date)
      expect(call.data.updatedAt).toBeInstanceOf(Date)
    })
  })

  // ── getOrCreateSource ──

  describe('getOrCreateSource()', () => {
    const sourceParams = {
      name: 'BibloRed',
      url: 'https://www.biblored.gov.co/eventos',
      platform: 'WEBSITE' as const,
      scraperType: 'cheerio-batch',
      cityId: 'city-1',
      verticalId: 'vert-1',
    }

    it('retorna id existente si la fuente ya existe', async () => {
      mockSourceFindFirst.mockResolvedValue({ id: 'existing-id' })

      const id = await logger.getOrCreateSource(sourceParams)

      expect(id).toBe('existing-id')
      expect(mockSourceCreate).not.toHaveBeenCalled()
    })

    it('crea fuente nueva si no existe', async () => {
      mockSourceFindFirst.mockResolvedValue(null)
      mockSourceCreate.mockResolvedValue({ id: 'new-id' })

      const id = await logger.getOrCreateSource(sourceParams)

      expect(id).toBe('new-id')
      expect(mockSourceCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'BibloRed',
          url: 'https://www.biblored.gov.co/eventos',
          platform: 'WEBSITE',
          scraperType: 'cheerio-batch',
          cityId: 'city-1',
          verticalId: 'vert-1',
          scheduleCron: '0 6 * * *',
          isActive: true,
        }),
      })
    })

    it('busca por URL exacta', async () => {
      mockSourceFindFirst.mockResolvedValue(null)
      mockSourceCreate.mockResolvedValue({ id: 'x' })

      await logger.getOrCreateSource(sourceParams)

      expect(mockSourceFindFirst).toHaveBeenCalledWith({
        where: { url: 'https://www.biblored.gov.co/eventos' },
      })
    })
  })
})
