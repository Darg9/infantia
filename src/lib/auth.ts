import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { UserRole } from '@/generated/prisma/client'

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
