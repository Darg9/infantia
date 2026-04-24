import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Corrigiendo nombres de columnas (snake_case → camelCase para tabla users)...')

  // El schema de users NO usa @map — usa camelCase directamente en la BD
  // Renombramos las columnas que se agregaron como snake_case
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "users" RENAME COLUMN "terms_version" TO "termsVersion"`
  )
  console.log('✅ terms_version → termsVersion')

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "users" RENAME COLUMN "privacy_version" TO "privacyVersion"`
  )
  console.log('✅ privacy_version → privacyVersion')

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "users" RENAME COLUMN "privacy_accepted_at" TO "privacyAcceptedAt"`
  )
  console.log('✅ privacy_accepted_at → privacyAcceptedAt')

  // Actualizar la migration SQL para que refleje los nombres correctos
  console.log('\nVerificando resultado...')
  const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'users'
     AND column_name IN ('termsVersion','privacyVersion','privacyAcceptedAt')
     ORDER BY column_name`
  )
  if (cols.length === 3) {
    console.log('✅ Las 3 columnas existen con nombres correctos:', cols.map(c => c.column_name).join(', '))
  } else {
    console.log('⚠️  Solo encontradas:', cols.map(c => c.column_name).join(', '))
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
