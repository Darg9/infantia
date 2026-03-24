import Link from 'next/link'
import { getSessionWithRole } from '@/lib/auth'
import { UserMenu } from '@/components/layout/UserMenu'

export async function Header() {
  const session = await getSessionWithRole()
  const avatarUrl = session?.user?.user_metadata?.avatar_url as string | undefined

  return (
    <header className="bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-orange-500">Infantia</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/actividades" className="text-gray-600 hover:text-gray-900 transition-colors">
            Actividades
          </Link>

          {session ? (
            <UserMenu
              email={session.user.email ?? ''}
              avatarUrl={avatarUrl}
              isAdmin={session.role === 'admin'}
            />
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                className="bg-orange-500 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                Registrarse
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
