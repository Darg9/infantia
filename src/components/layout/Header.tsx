import Link from 'next/link'
import { getSessionWithRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { UserMenu } from '@/components/layout/UserMenu'

export async function Header() {
  const session = await getSessionWithRole()
  const avatarUrl = session?.user?.user_metadata?.avatar_url as string | undefined

  let providerSlug: string | null = null
  if (session?.role === 'provider' && session.user.email) {
    const provider = await prisma.provider.findFirst({
      where: { email: session.user.email, isClaimed: true },
      select: { slug: true },
    })
    providerSlug = provider?.slug ?? null
  }

  return (
    <header className="bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-brand-500">HabitaPlan</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/actividades" className="text-gray-600 hover:text-gray-900 transition-colors">
            Actividades
          </Link>
          <Link href="/mapa" className="text-gray-600 hover:text-gray-900 transition-colors">
            Mapa
          </Link>

          <span className="w-px h-4 bg-gray-200" aria-hidden="true" />

          {session ? (
            <UserMenu
              email={session.user.email ?? ''}
              avatarUrl={avatarUrl}
              isAdmin={session.role === 'admin'}
              providerSlug={providerSlug}
            />
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Inicia sesión
              </Link>
              <Link
                href="/registro"
                className="border border-brand-400 text-brand-500 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-orange-50 transition-colors"
              >
                Regístrate
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
