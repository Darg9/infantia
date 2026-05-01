import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, ScrapingStatus } from '../../generated/prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

export type RunStats = {
  itemsFound: number
  itemsNew: number
  itemsUpdated: number
  itemsDuplicated: number
  errorMessage?: string
  metadata?: Record<string, unknown>
}

export class ScrapingLogger {
  /**
   * Inicia un log de ejecución. Retorna el logId para pasarlo a completeRun.
   */
  async startRun(sourceId: string): Promise<string> {
    const log = await prisma.scrapingLog.create({
      data: {
        sourceId,
        status: ScrapingStatus.RUNNING,
        startedAt: new Date(),
      },
    })
    return log.id
  }

  /**
   * Finaliza el log con los resultados de la ejecución.
   */
  async completeRun(logId: string, stats: RunStats): Promise<void> {
    const status =
      stats.errorMessage && stats.itemsFound === 0
        ? ScrapingStatus.FAILED
        : stats.errorMessage
        ? ScrapingStatus.PARTIAL
        : ScrapingStatus.SUCCESS

    await prisma.scrapingLog.update({
      where: { id: logId },
      data: {
        finishedAt: new Date(),
        status,
        itemsFound: stats.itemsFound,
        itemsNew: stats.itemsNew,
        itemsUpdated: stats.itemsUpdated,
        itemsDuplicated: stats.itemsDuplicated,
        errorMessage: stats.errorMessage ?? null,
        metadata: stats.metadata ? (stats.metadata as import('../../generated/prisma/client').Prisma.InputJsonValue) : undefined,
      },
    })
  }

  /**
   * Actualiza lastRunAt, lastRunStatus y lastRunItems en ScrapingSource.
   */
  async updateSourceStatus(
    sourceId: string,
    status: ScrapingStatus,
    itemsFound: number
  ): Promise<void> {
    await prisma.scrapingSource.update({
      where: { id: sourceId },
      data: {
        lastRunAt: new Date(),
        lastRunStatus: status,
        lastRunItems: itemsFound,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * Busca o crea un ScrapingSource por URL.
   */
  async getOrCreateSource(params: {
    name: string
    url: string
    platform: 'WEBSITE' | 'INSTAGRAM' | 'FACEBOOK' | 'TELEGRAM' | 'TIKTOK' | 'X' | 'WHATSAPP'
    scraperType: string
    cityId: string
    verticalId: string
  }): Promise<string> {
    const existing = await prisma.scrapingSource.findFirst({
      where: { url: params.url },
    })
    if (existing) return existing.id

    const created = await prisma.scrapingSource.create({
      data: {
        name: params.name,
        url: params.url,
        platform: params.platform,
        scraperType: params.scraperType,
        cityId: params.cityId,
        verticalId: params.verticalId,
        scheduleCron: '0 6 * * *', // default: 6am daily
        isActive: true,
      },
    })
    return created.id
  }
}
