'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface ProfileSidebarProps {
  userName: string
  userEmail: string
  avatarUrl: string | null
}

const NAV_ITEMS = [
  { href: '/perfil', label: 'Mi perfil', icon: '👤' },
  { href: '/perfil/editar', label: 'Editar perfil', icon: '✏️' },
  { href: '/perfil/favoritos', label: 'Mis favoritos', icon: '❤️' },
  { href: '/perfil/hijos', label: 'Mis hijos', icon: '👶' },
  { href: '/perfil/historial', label: 'Historial', icon: '🕐' },
  { href: '/perfil/calificaciones', label: 'Mis calificaciones', icon: '⭐' },
  { href: '/perfil/notificaciones', label: 'Notificaciones', icon: '🔔' },
]

export function ProfileSidebar({ userName, userEmail, avatarUrl }: ProfileSidebarProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/perfil') return pathname === '/perfil'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-gray-100 bg-white min-h-[calc(100vh-3.5rem)]">
        {/* User info */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={userName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-sm">
                {(userName?.[0] ?? userEmail?.[0] ?? '?').toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{userName || '—'}</p>
              <p className="text-xs text-gray-400 truncate">{userEmail}</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                isActive(item.href)
                  ? 'border-l-2 border-orange-500 bg-orange-50 text-orange-700 font-medium'
                  : 'border-l-2 border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile horizontal nav */}
      <div className="lg:hidden border-b border-gray-100 bg-white overflow-x-auto">
        <nav className="flex gap-1 px-4 py-2 min-w-max">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                isActive(item.href)
                  ? 'bg-orange-100 text-orange-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  )
}
