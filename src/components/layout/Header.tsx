import Link from 'next/link'
import { getSessionWithRole } from '@/lib/auth'
import { LogoutButton } from '@/components/LogoutButton'

export async function Header() {
  const session = await getSessionWithRole()

  return (
    <header className="bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-orange-500">Infantia</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/actividades" className="text-gray-600 hover:text-gray-900 transition-colors">
            Actividades
          </Link>

          {session ? (
            <>
              {session.role === 'admin' && (
                <Link
                  href="/admin"
                  className="text-orange-600 hover:text-orange-700 font-medium transition-colors"
                >
                  Admin
                </Link>
              )}

              <Link href="/perfil" className="text-gray-600 hover:text-gray-900 transition-colors">
                Mi perfil
              </Link>

              <div className="flex items-center gap-2 ml-2">
                <div className="w-7 h-7 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-semibold">
                  {(session.user.email?.[0] ?? '?').toUpperCase()}
                </div>
                <LogoutButton />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
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
