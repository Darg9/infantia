/**
 * Crea (upsert) los 4 ScrapingSource conocidos en la BD.
 * Uso: npx tsx scripts/seed-scraping-sources.ts
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const SOURCES = [
  {
    name: 'BibloRed',
    url: 'https://www.biblored.gov.co/eventos',
    platform: 'WEBSITE' as const,
    scraperType: 'cheerio-batch',
  },
  {
    name: 'Bogotá.gov.co',
    url: 'https://bogota.gov.co/mi-ciudad/cultura-recreacion-y-deporte',
    platform: 'WEBSITE' as const,
    scraperType: 'cheerio-batch',
  },
  {
    name: 'Instagram: fcecolombia',
    url: 'https://www.instagram.com/fcecolombia',
    platform: 'INSTAGRAM' as const,
    scraperType: 'playwright',
  },
  {
    name: 'Instagram: quehaypahacerenbogota',
    url: 'https://www.instagram.com/quehaypahacerenbogota',
    platform: 'INSTAGRAM' as const,
    scraperType: 'playwright',
  },
  {
    name: 'Cultura Recreación y Deporte – Centro Felicidad Chapinero',
    url: 'https://www.culturarecreacionydeporte.gov.co/es/centro-felicidad-chapinero/eventos',
    platform: 'WEBSITE' as const,
    scraperType: 'cheerio-batch',
  },
]

async function main() {
  const city = await prisma.city.findFirst({ where: { name: { contains: 'Bogot' } } })
  if (!city) {
    console.error('Ciudad Bogotá no encontrada. Ejecuta el seed principal primero.')
    process.exit(1)
  }

  const vertical = await prisma.vertical.findUnique({ where: { slug: 'kids' } })
  if (!vertical) {
    console.error('Vertical "kids" no encontrada. Ejecuta el seed principal primero.')
    process.exit(1)
  }

  for (const source of SOURCES) {
    const existing = await prisma.scrapingSource.findFirst({
      where: { url: source.url },
    })

    if (existing) {
      console.log(`[SKIP] Ya existe: ${source.name}`)
      continue
    }

    await prisma.scrapingSource.create({
      data: {
        name: source.name,
        url: source.url,
        platform: source.platform,
        scraperType: source.scraperType,
        cityId: city.id,
        verticalId: vertical.id,
        scheduleCron: '0 6 * * *',
        isActive: true,
      },
    })

    console.log(`[OK] Creado: ${source.name}`)
  }

  await prisma.$disconnect()
  console.log('Seed de scraping sources completado.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
