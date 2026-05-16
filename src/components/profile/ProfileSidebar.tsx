'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Avatar } from '@/components/ui/avatar'

interface ProfileSidebarProps {
  userName: string
  userEmail: string
  avatarUrl: string | null
}

const NAV_ITEMS = [
  { href: '/perfil', label: 'Cuenta', icon: '👤' },
  { href: '/perfil/favoritos', label: 'Favoritos', icon: '❤️' },
  { href: '/perfil/hijos', label: 'Familia', icon: '👨‍👩‍👧' },
  { href: '/perfil/historial', label: 'Historial', icon: '🕐' },
  { href: '/perfil/calificaciones', label: 'Calificaciones', icon: '⭐' },
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
      <aside className='hidden lg:flex flex-col w-64 shrink-0 border-r border-[var(--hp-border)] border-[var(--hp-border-subtle)] bg-[var(--hp-bg-surface)] min-h-[calc(100vh-3.5rem)]'>

        {/* User card */}
        <div className='p-5 border-b border-[var(--hp-border)] border-[var(--hp-border-subtle)]'>
          <div className="flex items-center gap-3">
            {/* Avatar tamaño lg (64px) — más prominente que el topbar (sm/md) */}
            <Avatar
              src={avatarUrl}
              name={userName || userEmail}
              size="lg"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--hp-text-primary)] dark:text-white truncate">
                {userName || '—'}
              </p>
              <p className="text-xs text-[var(--hp-text-muted)] dark:text-[var(--hp-text-secondary)] truncate">{userEmail}</p>
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
                    ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 font-semibold'
                    : 'text-[var(--hp-text-secondary)] hover:bg-[var(--hp-bg-subtle)] hover:text-[var(--hp-text-primary)] dark:hover:text-white',
                ].join(' ')}
              >
                {/* Active indicator bar — requiere relative en el Link padre */}
                <span
                  className={[
                    'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-brand-500 transition-opacity',
                    active ? 'opacity-100' : 'opacity-0',
                  ].join('')}
                  aria-hidden="true"
                />
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      {/* ── Mobile horizontal nav ── */}
      <div className='lg:hidden border-b border-[var(--hp-border)] border-[var(--hp-border-subtle)] bg-[var(--hp-bg-surface)] overflow-x-auto'>
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
                    ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-semibold'
                    : 'text-[var(--hp-text-secondary)] hover:bg-[var(--hp-bg-subtle)] hover:text-[var(--hp-text-primary)] dark:hover:text-white',
                ].join(' ')}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
