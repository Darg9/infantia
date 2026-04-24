import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Obtener la fuente FCE existente para copiar cityId, verticalId, scheduleCron
  const existing = await prisma.scrapingSource.findUnique({
    where: { id: 'f628a61a-fbf7-4c77-b868-73573e5b4dd1' },
    select: {
      cityId: true,
      verticalId: true,
      scraperType: true,
      scheduleCron: true,
      platform: true,
      config: true,
    },
  })

  if (!existing) {
    console.error('❌ Fuente FCE base no encontrada')
    process.exit(1)
  }

  console.log('Config base FCE:', JSON.stringify(existing, null, 2))

  // Las 2 URLs adicionales
  const newSources = [
    {
      name: 'FCE — Talleres a Fondo',
      url: 'https://fce.com.co/talleres-a-fondo/',
    },
    {
      name: 'FCE — Concursos',
      url: 'https://fce.com.co/concursos/',
    },
  ]

  for (const s of newSources) {
    // Verificar si ya existe
    const exists = await prisma.scrapingSource.findFirst({
      where: { url: s.url },
      select: { id: true, name: true },
    })

    if (exists) {
      console.log(`⚠️  Ya existe: ${exists.name} (${exists.id.slice(0, 8)}) — omitido`)
      continue
    }

    const created = await prisma.scrapingSource.create({
      data: {
        name: s.name,
        platform: existing.platform,
        url: s.url,
        cityId: existing.cityId,
        verticalId: existing.verticalId,
        scraperType: existing.scraperType,
        scheduleCron: existing.scheduleCron,
        isActive: true,
        config: existing.config ?? undefined,
        notes: 'Fuente FCE adicional — creada junto con programacion-cultural al reemplazar filbo/agenda/',
      },
      select: { id: true, name: true, url: true },
    })

    console.log(`✅ Creado: ${created.name}`)
    console.log(`   ID : ${created.id}`)
    console.log(`   URL: ${created.url}`)
  }

  // Verificar estado final de todas las fuentes FCE web
  console.log('\n══ Estado final fuentes FCE ══')
  const allFce = await prisma.scrapingSource.findMany({
    where: {
      url: { contains: 'fce.com.co' },
      platform: 'WEBSITE',
    },
    select: { id: true, name: true, url: true, isActive: true, lastRunStatus: true },
    orderBy: { createdAt: 'asc' },
  })
  for (const s of allFce) {
    const status = s.lastRunStatus ?? 'sin run'
    console.log(`  [${s.isActive ? '✅' : '❌'}] ${s.name}`)
    console.log(`       ${s.url}  (${status})`)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
