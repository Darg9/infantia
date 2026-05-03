'use client';
import { Button } from '@/components/ui';

// =============================================================================
// MobileNav — Dual Navigation Model (≤768px only)
//
// Structure:
//   1. MobileHeader  → sticky top: [☰] [Logo centered] [ThemeToggle]
//   2. MobileDrawer  → slide-in from left: all secondary links + session
//   3. BottomNav     → sticky bottom: Explorar | Mapa | Guardados | Perfil
//
// Desktop (≥769px) → hidden via CSS. Zero impact on existing layout.
// =============================================================================

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Compass, Map as MapIcon, Heart, User, Sun, Moon, Grid, PlusCircle, HelpCircle, Mail, Shield, ShieldCheck, MapPinned, Menu, X } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { CitySwitcher } from '@/components/layout/CitySwitcher'
import type { CityOption } from '@/components/providers/CityProvider'
import { useTheme } from '@/hooks/useTheme'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MobileNavProps {
  /** User session props forwarded from Server Component */
  session: {
    email: string
    avatarUrl?: string
    isAdmin?: boolean
    providerSlug?: string | null
  } | null
  /** Ciudades activas para el CitySwitcher del drawer */
  cities: CityOption[]
}

// ─── Icons (inline SVG, no extra deps) ───────────────────────────────────────

function IconHamburger({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="18" y1="6"  x2="6"  y2="18" />
      <line x1="6"  y1="6"  x2="18" y2="18" />
    </svg>
  )
}

function IconExplore({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.5 : 2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function IconMap({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.5 : 2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  )
}

function IconSaved({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} strokeWidth={active ? 2.5 : 2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconProfile({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} strokeWidth={active ? 2.5 : 2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

// ─── Drawer sections config ───────────────────────────────────────────────────

const DRAWER_SECTIONS = [
  {
    title: 'Explorar',
    links: [
      { label: 'Actividades',      href: '/actividades', icon: MapPinned },
      { label: 'Mapa',             href: '/mapa',        icon: MapIcon },
      { label: 'Categorías',       href: '/actividades', icon: Grid },
    ],
  },
  {
    title: 'Publicar',
    links: [
      { label: 'Publica una actividad', href: '/anunciate', icon: PlusCircle },
      { label: 'Cómo funciona',         href: '/contribuir', icon: HelpCircle },
    ],
  },
  {
    title: 'Ayuda',
    links: [
      { label: 'Contacto',             href: '/contacto', icon: Mail },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Centro de Seguridad',              href: '/seguridad',         icon: ShieldCheck },
      { label: 'Términos de uso',                  href: '/terminos',          icon: Shield },
      { label: 'Política de privacidad',           href: '/privacidad',        icon: Shield },
      { label: 'Política de tratamiento de datos', href: '/seguridad/datos', icon: Shield },
    ],
  },
] as const

// ─── Bottom nav tabs config ───────────────────────────────────────────────────

const BOTTOM_TABS = [
  { label: 'Explorar',  href: '/actividades',      icon: Compass },
  { label: 'Mapa',      href: '/mapa',             icon: MapIcon },
  { label: 'Guardados', href: '/perfil/favoritos', icon: Heart   },
  { label: 'Perfil',    href: '/perfil',           icon: User    },
] as const

// ─── Theme toggle — delega a ThemeProvider vía useTheme() ────────────────────
// Reemplaza el patrón useState/useEffect (set-state-in-effect) por el hook
// compartido con el toggle de escritorio. Ambos quedan sincronizados.

function MobileThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  // isMounted previene hydration mismatch: el icono del tema solo se conoce
  // en el cliente. Se omite en SSR y se muestra tras el primer montaje.
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true)
  }, [])

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggleTheme}
      aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--hp-border-subtle)] text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)] hover:bg-[var(--hp-bg-subtle)] transition-colors"
    >
      {/* Icono omitido en SSR, presente tras montaje — evita hydration mismatch */}
      {isMounted && <Icon icon={dark ? Sun : Moon} size="lg" />}
    </Button>
  )
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function MobileDrawer({
  open,
  onClose,
  session,
  cities,
}: {
  open: boolean
  onClose: () => void
  session: MobileNavProps['session']
  cities: CityOption[]
}) {
  const router = useRouter()
  const drawerRef = useRef<HTMLDivElement>(null)

  // Focus trap
  useEffect(() => {
    if (!open) return
    const el = drawerRef.current
    if (!el) return
    const focusables = el.querySelectorAll<HTMLElement>(
      'a, button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusables[0]
    const last  = focusables[focusables.length - 1]
    first?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    onClose()
    router.push('/')
    router.refresh()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-[var(--hp-bg-surface)] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--hp-border)]">
          <Link href="/" onClick={onClose} className="flex items-center gap-2 relative w-[105px] h-7">
            <Image
              src="/logo.svg"
              alt="HabitaPlan"
              fill
              className="object-contain dark:hidden"
            />
            <Image
              src="/logo-dark.svg"
              alt="HabitaPlan"
              fill
              className="object-contain hidden dark:block"
            />
          </Link>
          <Button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="p-2 rounded-lg text-[var(--hp-text-secondary)] hover:bg-[var(--hp-bg-subtle)] transition-colors"
          >
            <Icon icon={X} size="lg" />
          </Button>
        </div>

        {/* Session banner */}
        {session && (
          <div className="px-4 py-3 border-b border-[var(--hp-border)] bg-[var(--hp-bg-subtle)]">
            <p className="text-xs text-[var(--hp-text-muted)]">Sesión iniciada como</p>
            <p className="text-sm font-medium text-[var(--hp-text-primary)] truncate">{session.email}</p>
          </div>
        )}

        {/* Nav sections */}
        <nav aria-label="Menú lateral" className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Selector de ciudad — solo visible cuando hay 2+ ciudades activas */}
          <CitySwitcher cities={cities} variant="drawer" />

          {/* Admin / Provider quick links */}
          {(session?.isAdmin || session?.providerSlug) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--hp-text-muted)] mb-2">Panel</p>
              <ul className="space-y-1">
                {session.isAdmin && (
                  <li>
                    <Link
                      href="/admin"
                      onClick={onClose}
                      className="block px-3 py-2.5 rounded-lg text-sm font-medium text-brand-500 hover:bg-brand-500/10 transition-colors"
                    >
                      Admin
                    </Link>
                  </li>
                )}
                {session.providerSlug && (
                  <li>
                    <Link
                      href={`/proveedores/${session.providerSlug}/dashboard`}
                      onClick={onClose}
                      className="block px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--hp-badge-provider-text)] hover:bg-[var(--hp-badge-provider-bg)] transition-colors"
                    >
                      Panel de proveedor
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          )}

          {DRAWER_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--hp-text-muted)] mb-2">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      onClick={onClose}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--hp-text-primary)] hover:bg-[var(--hp-bg-subtle)] hover:text-[var(--color-brand-500)] transition-colors group"
                    >
                      <Icon icon={link.icon} size="md" className="text-[var(--hp-text-muted)] group-hover:text-[var(--color-brand-500)] transition-colors" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Session footer */}
        <div className="border-t border-[var(--hp-border)] px-4 py-4">
          {session ? (
            <Button
              onClick={handleLogout}
              className="w-full px-3 py-2.5 rounded-lg text-sm font-medium text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors text-left"
            >
              Cerrar sesión
            </Button>
          ) : (
            <div className="space-y-2">
              <Link
                href="/login"
                onClick={onClose}
                className="block w-full px-3 py-2.5 rounded-lg text-sm font-medium text-center border border-[var(--hp-border)] text-[var(--hp-text-primary)] hover:bg-[var(--hp-bg-subtle)] transition-colors"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                onClick={onClose}
                className="block w-full px-3 py-2.5 rounded-lg text-sm font-medium text-center bg-brand-500 text-white hover:bg-brand-600 transition-colors"
              >
                Registrarse
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Bottom Navigation ────────────────────────────────────────────────────────

function BottomNav({ session }: { session: MobileNavProps['session'] }) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/actividades') return pathname.startsWith('/actividades')
    if (href === '/mapa')        return pathname.startsWith('/mapa')
    if (href === '/perfil')      return pathname.startsWith('/perfil')
    return pathname === href
  }

  function getHref(tab: typeof BOTTOM_TABS[number]) {
    // "Guardados" y "Perfil" → redirigen a login si no hay sesión
    if ((tab.href === '/perfil/favoritos' || tab.href === '/perfil') && !session) {
      return '/login'
    }
    return tab.href
  }

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-30 bg-[var(--hp-bg-surface)] border-t border-[var(--hp-border)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-md mx-auto flex items-stretch justify-between h-16 px-2 sm:px-4">
        {BOTTOM_TABS.map((tab) => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.label}
              href={getHref(tab)}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className="flex-1 relative flex flex-col items-center justify-center gap-1 transition-colors"
            >
              {active && (
                <div className="absolute top-0 h-[2px] w-6 bg-[var(--color-brand-500)] rounded-full" />
              )}
              <Icon icon={tab.icon} size="xl" active={active} muted={!active} />
              <span className={`text-[10px] font-medium ${active ? 'text-[var(--color-brand-500)]' : 'text-[var(--hp-text-muted)]'}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Mobile Header (sticky top) ──────────────────────────────────────────────

function MobileHeader({
  onOpenDrawer,
  session,
}: {
  onOpenDrawer: () => void
  session: MobileNavProps['session']
}) {
  return (
    <header
      aria-label="Cabecera móvil"
      className="sticky top-0 z-30 bg-[var(--hp-bg-surface)] border-b border-[var(--hp-border)] transition-colors duration-[var(--hp-transition)]"
    >
      <div className="flex items-center justify-between px-4 h-14">
        {/* Left: logo */}
        <Link
          href="/"
          aria-label="HabitaPlan — Inicio"
          className="flex items-center relative w-[120px] h-8 md:w-[150px] md:h-10"
        >
          <Image
            src="/logo.svg"
            alt="HabitaPlan"
            fill
            className="object-contain dark:hidden"
            priority
          />
          <Image
            src="/logo-dark.svg"
            alt="HabitaPlan"
            fill
            className="object-contain hidden dark:block"
            priority
          />
        </Link>

        {/* Right: theme & hamburger */}
        <div className="flex items-center gap-2">
          <MobileThemeToggle />
          <Button
            variant="ghost"
            onClick={onOpenDrawer}
            aria-label="Abrir menú de navegación"
            aria-haspopup="dialog"
            className="p-2 rounded-lg text-[var(--hp-text-secondary)] hover:bg-[var(--hp-bg-subtle)] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Icon icon={Menu} size="lg" />
          </Button>
        </div>
      </div>
    </header>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function MobileNav({ session, cities }: MobileNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <MobileHeader
        onOpenDrawer={() => setDrawerOpen(true)}
        session={session}
      />
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        session={session}
        cities={cities}
      />
      <BottomNav session={session} />
    </>
  )
}
