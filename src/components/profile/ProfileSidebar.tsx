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
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 min-h-[calc(100vh-3.5rem)]">

        {/* User card */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={userName}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-700 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                {(userName?.[0] ?? userEmail?.[0] ?? '?').toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {userName || '—'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{userEmail}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3" aria-label="Menú de perfil">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'relative flex items-center gap-3 px-4 py-2.5 mx-2 rounded-xl text-sm transition-colors overflow-hidden',
                  active
                    ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white',
                ].join(' ')}
              >
                {/* Active indicator bar — requiere relative en el Link padre */}
                <span
                  className={[
                    'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-orange-500 transition-opacity',
                    active ? 'opacity-100' : 'opacity-0',
                  ].join(' ')}
                  aria-hidden="true"
                />
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* ── Mobile horizontal nav ── */}
      <div className="lg:hidden border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
        <nav className="flex gap-1 px-4 py-2 min-w-max" aria-label="Menú de perfil">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors',
                  active
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-semibold'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200',
                ].join(' ')}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
