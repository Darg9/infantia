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
  // El conteo por ciudad usa el mismo OR filter que la página de actividades
  // (locationId null OR location.cityId) + calidad — así selector y página muestran
  // el mismo número.
  const [rawCities, badDomainSources] = await Promise.all([
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true, defaultLat: true, defaultLng: true, defaultZoom: true },
      orderBy: [{ locations: { _count: 'desc' } }, { name: 'asc' }],
    }),
    prisma.sourceHealth.findMany({
      where: { score: { lt: 0.1 } },
      select: { source: true },
    }),
  ])
  const badDomains = badDomainSources.map((h) => h.source)

  // Conteo ESTRICTO por ciudad: solo actividades con location.cityId = city.id.
  // El OR pattern (que incluye locationId=null) infla los contadores de todas las ciudades
  // con las mismas actividades sin geocodificar → Barranquilla, Pereira, etc. muestran
  // el mismo "(2)" que Bogotá, aunque no tienen contenido local real.
  // Los resultados de búsqueda siguen usando OR (buildActivityWhere) para ser más generosos.
  const badDomainsFilter = badDomains.length > 0
    ? { AND: [{ OR: [{ sourceDomain: null }, { NOT: { sourceDomain: { in: badDomains } } }] }] }
    : {}
  const activityCountEntries = await Promise.all(
    rawCities.map(async (city) => {
      const count = await prisma.activity.count({
        where: {
          status: 'ACTIVE',
          locationId: { not: null },
          location: { cityId: city.id },
          ...badDomainsFilter,
        },
      })
      return [city.id, count] as [string, number]
    }),
  )
  const countByCityId = Object.fromEntries(activityCountEntries)

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
