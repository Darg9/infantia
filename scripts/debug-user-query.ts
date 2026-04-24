import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Buscar TODOS los campos del user para ver cuál falla
  try {
    const r = await prisma.user.findFirst()
    console.log('✅ findFirst sin select OK:', r ? Object.keys(r).join(', ') : 'no users')
  } catch (e: any) {
    console.log('❌ findFirst sin select:', e.message.slice(0, 500))
  }

  // Buscar solo el id para ver si la tabla funciona
  try {
    const r = await prisma.user.findFirst({ select: { id: true } })
    console.log('✅ findFirst id only OK:', r)
  } catch (e: any) {
    console.log('❌ findFirst id only:', e.message.slice(0, 500))
  }

  // Verificar contact_requests existe
  try {
    const r = await prisma.contactRequest.findFirst({ select: { id: true } })
    console.log('✅ contactRequest findFirst OK:', r)
  } catch (e: any) {
    console.log('❌ contactRequest findFirst:', e.message.slice(0, 300))
  }

  await prisma.$disconnect()
}

main().catch(e => console.error(e.message))
