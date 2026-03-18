// =============================================================================
// Script manual: marcar actividades expiradas
// Uso: npx tsx scripts/expire-activities.ts
// =============================================================================

import { expireActivities } from '../src/lib/expire-activities'

async function main() {
  console.log('🔍 Buscando actividades expiradas...')

  const result = await expireActivities()

  if (result.expired === 0) {
    console.log('✅ No hay actividades para expirar.')
  } else {
    console.log(`✅ ${result.expired} actividad(es) marcada(s) como EXPIRED:`)
    result.ids.forEach((id) => console.log(`   - ${id}`))
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
