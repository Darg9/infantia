import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Obtener columnas reales de la tabla users en BD
  const dbCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY column_name`
  )
  const dbColSet = new Set(dbCols.map(c => c.column_name))
  console.log('\nColumnas en BD (users):', [...dbColSet].join(', '))

  // Campos del modelo User en el schema (mapeados a snake_case)
  // Los listo manualmente del schema.prisma para comparar
  const schemaFields: [string, string][] = [
    ['id', 'id'],
    ['email', 'email'],
    ['role', 'role'],
    ['phone', 'phone'],
    ['name', 'name'],
    ['termsAcceptedAt', 'terms_accepted_at'],
    ['termsVersion', 'terms_version'],
    ['privacyAcceptedAt', 'privacy_accepted_at'],
    ['privacyVersion', 'privacy_version'],
    ['provider', 'provider'],
    ['avatarUrl', 'avatar_url'],
    ['cityId', 'city_id'],
    ['onboardingDone', 'onboarding_done'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
    ['ratingAvg', 'rating_avg'],
    ['ratingCount', 'rating_count'],
    ['isPremium', 'is_premium'],
  ]

  console.log('\nComparación schema vs BD:')
  let missing = 0
  for (const [field, col] of schemaFields) {
    if (!dbColSet.has(col)) {
      console.log(`  ❌ MISSING: ${field} → "${col}"`)
      missing++
    } else {
      console.log(`  ✅ OK: ${field} → "${col}"`)
    }
  }

  if (missing === 0) console.log('\n✅ Todos los campos del schema están en BD')
  else console.log(`\n❌ ${missing} campo(s) faltante(s) en BD`)

  await prisma.$disconnect()
}

main().catch(e => console.error(e.message))
