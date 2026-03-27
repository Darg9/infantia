/**
 * Backfill: genera slugs para proveedores que no tienen uno.
 * Uso: npx tsx scripts/backfill-provider-slugs.ts
 */

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import * as dotenv from 'dotenv'
dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // eliminar tildes
    .replace(/[^a-z0-9]+/g, '-')    // reemplazar no-alfanuméricos con guion
    .replace(/^-|-$/g, '')           // quitar guiones al inicio/fin
    .slice(0, 100)
}

async function main() {
  const providers = await prisma.provider.findMany({
    where: { slug: null },
    select: { id: true, name: true },
  })

  console.log(`Proveedores sin slug: ${providers.length}`)

  for (const provider of providers) {
    let slug = toSlug(provider.name)

    // Si el slug ya existe, agregar sufijo numérico
    const existing = await prisma.provider.findUnique({ where: { slug } })
    if (existing && existing.id !== provider.id) {
      slug = `${slug}-2`
    }

    await prisma.provider.update({
      where: { id: provider.id },
      data: { slug },
    })
    console.log(`  ${provider.name} → ${slug}`)
  }

  console.log('✅ Backfill completo')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
