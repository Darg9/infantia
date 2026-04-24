import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const user = await prisma.user.findFirst({
    select: { termsVersion: true, privacyVersion: true, privacyAcceptedAt: true },
  })
  console.log('✅ User campos legales OK:', JSON.stringify(user))

  const contact = await prisma.contactRequest.findFirst({
    select: { status: true, resolvedAt: true, resolvedBy: true },
  })
  console.log('✅ ContactRequest campos PQRS OK:', JSON.stringify(contact))

  await prisma.$disconnect()
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
