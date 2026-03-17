/**
 * Promueve un usuario a rol ADMIN.
 * Uso: npx tsx scripts/promote-admin.ts <email>
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env
 * (Settings → API → service_role key en el dashboard de Supabase)
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Uso: npx tsx scripts/promote-admin.ts <email>')
    process.exit(1)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    console.error(
      'Falta SUPABASE_SERVICE_ROLE_KEY en .env\n' +
      'Encuéntrala en: Supabase Dashboard → Settings → API → service_role key'
    )
    process.exit(1)
  }

  // Admin client con service role (bypassa RLS)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Buscar usuario en auth.users por email
  const { data: listData, error: listError } =
    await supabaseAdmin.auth.admin.listUsers()

  if (listError) {
    console.error('Error al listar usuarios:', listError.message)
    process.exit(1)
  }

  const authUser = listData.users.find((u) => u.email === email)
  if (!authUser) {
    console.error(`Usuario no encontrado en auth: ${email}`)
    process.exit(1)
  }

  // 2. Actualizar app_metadata.role en auth.users
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    authUser.id,
    { app_metadata: { ...authUser.app_metadata, role: 'admin' } }
  )

  if (updateError) {
    console.error('Error al actualizar auth metadata:', updateError.message)
    process.exit(1)
  }

  // 3. Actualizar public.users.role via Prisma (si existe)
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: authUser.id },
  })

  if (dbUser) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { role: 'ADMIN' },
    })
    console.log('role = ADMIN actualizado en public.users')
  } else {
    console.log('(Usuario no encontrado en public.users — se sincronizara al hacer login)')
  }

  await prisma.$disconnect()

  console.log(`\n${email} promovido a ADMIN. Cierra sesion y vuelve a entrar para aplicar.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
