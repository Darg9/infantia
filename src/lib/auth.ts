import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { UserRole } from '@/generated/prisma/client'
import type { User } from '@supabase/supabase-js'

export async function getSession() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getSessionWithRole() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // El rol definitivo se lee de app_metadata (seteado por promote-admin script)
  const role = (user.app_metadata?.role as string | undefined) ?? 'parent'

  return { user, role }
}

/**
 * Obtiene o crea el registro del usuario en la tabla `users`.
 * Úsalo en las páginas del perfil en lugar de prisma.user.findUnique.
 */
export async function getOrCreateDbUser(authUser: User) {
  const name =
    authUser.user_metadata?.full_name ??
    authUser.user_metadata?.name ??
    authUser.email?.split('@')[0] ??
    'Usuario'
    
  const provider = authUser.app_metadata?.provider ?? 'email'
  
  return prisma.user.upsert({
    where: { supabaseAuthId: authUser.id },
    create: {
      supabaseAuthId: authUser.id,
      email: authUser.email ?? null,
      phone: authUser.phone ?? null,
      provider: provider,
      name,
      role: 'PARENT',
    },
    update: {
      provider: provider,
      ...(authUser.email ? { email: authUser.email } : {}),
      ...(authUser.phone ? { phone: authUser.phone } : {}),
    },
  })
}

export async function requireAuth() {
  const user = await getSession()
  if (!user) redirect('/login')
  return user
}

export async function requireRole(roles: UserRole[]) {
  const session = await getSessionWithRole()
  if (!session) redirect('/login')

  const roleMap: Record<string, UserRole> = {
    admin: UserRole.ADMIN,
    moderator: UserRole.MODERATOR,
    provider: UserRole.PROVIDER,
    parent: UserRole.PARENT,
  }

  const userRole = roleMap[session.role] ?? UserRole.PARENT
  if (!roles.includes(userRole)) redirect('/')

  return session
}
