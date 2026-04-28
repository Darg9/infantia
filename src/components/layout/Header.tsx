import Link from 'next/link'
import Image from 'next/image'
import { getSessionWithRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { UserMenu } from '@/components/layout/UserMenu'
import { buttonVariants } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { MobileNav } from '@/components/layout/MobileNav'
import { CitySwitcher } from '@/components/layout/CitySwitcher'
import type { CityOption } from '@/components/providers/CityProvider'

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

  // Cargar ciudades activas para el selector (solo si hay 2+)
  const [rawCities, rawActivityCounts] = await Promise.all([
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true, defaultLat: true, defaultLng: true, defaultZoom: true },
      // Ciudad con más locations primero (≈ Bogotá) para que el fallback del CitySwitcher
      // coincida con el default del CityProvider en /actividades. Secundario: nombre asc.
      orderBy: [{ locations: { _count: 'desc' } }, { name: 'asc' }],
    }),
    // Contamos ACTIVIDADES (no locations) por ciudad para que el número del selector
    // sea consistente con lo que el usuario ve al hacer clic.
    // Actividades sin locationId no tienen ciudad asignada → no se cuentan aquí,
    // pero sí aparecen en /actividades gracias al OR filter de CityProvider.
    prisma.activity.findMany({
      where: { status: 'ACTIVE', locationId: { not: null } },
      select: { location: { select: { cityId: true } } },
    }),
  ])

  // Agrupa conteos de actividades por ciudad en memoria (evita raw SQL)
  const countByCityId: Record<string, number> = {}
  for (const a of rawActivityCounts) {
    const cid = a.location?.cityId
    if (cid) countByCityId[cid] = (countByCityId[cid] ?? 0) + 1
  }

  const cities: CityOption[] = rawCities
    .map((c) => ({
      id:            c.id,
      name:          c.name,
      defaultLat:    Number(c.defaultLat),
      defaultLng:    Number(c.defaultLng),
      defaultZoom:   c.defaultZoom,
      activityCount: countByCityId[c.id] ?? 0,
    }))
    // Solo mostrar ciudades con al menos 1 actividad activa en el selector público.
    // Ciudades con 0 activos generarían frustración al usuario (resultados vacíos).
    .filter((c) => (c.activityCount ?? 0) > 0)

  // Props forwarded to the mobile client component
  const mobileSession = session
    ? {
        email: session.user.email ?? '',
        avatarUrl,
        isAdmin: session.role === 'admin',
        providerSlug,
      }
    : null

  return (
    <>
      {/* ── Mobile navigation (≤ md): header + drawer + bottom nav ──────────
          Hidden on md+ via `md:hidden` wrapper inside MobileNav              */}
      <div className="md:hidden">
        <MobileNav session={mobileSession} cities={cities} />
      </div>

      {/* ── Desktop header (≥ md): unchanged ─────────────────────────────── */}
      <header
        aria-label="Sitio principal"
        className="hidden md:block bg-[var(--hp-bg-surface)] border-b border-[var(--hp-border)] transition-colors duration-[var(--hp-transition)]"
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="HabitaPlan Logo"
              width={150}
              height={40}
              className="h-10 w-auto object-contain dark:hidden"
              priority
            />
            <Image
              src="/logo-dark.svg"
              alt="HabitaPlan Logo"
              width={150}
              height={40}
              className="h-10 w-auto object-contain hidden dark:block"
              priority
            />
          </Link>

          {/* Nav */}
          <nav aria-label="Navegación principal" className="flex items-center gap-6 text-sm">
            <Link href="/actividades" className="text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)] transition-colors">
              Actividades
            </Link>
            <Link href="/mapa" className="text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)] transition-colors">
              Mapa
            </Link>

            {/* Selector de ciudad — solo visible cuando hay 2+ ciudades activas */}
            <CitySwitcher cities={cities} variant="desktop" />

            <ThemeToggle />

            <span className="w-px h-4 bg-[var(--hp-border)]" aria-hidden="true" />

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
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  Inicia sesión
                </Link>
                <Link
                  href="/registro"
                  className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                >
                  Regístrate
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>
    </>
  )
}
