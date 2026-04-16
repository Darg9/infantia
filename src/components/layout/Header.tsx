import Link from 'next/link'
import { getSessionWithRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { UserMenu } from '@/components/layout/UserMenu'
import { buttonVariants } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

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
    <header aria-label="Sitio principal" className="bg-[var(--hp-bg-surface)] border-b border-[var(--hp-border)] transition-colors duration-[var(--hp-transition)]">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-brand-500">HabitaPlan</span>
        </Link>

        {/* Nav */}
        <nav aria-label="Navegación principal" className="flex items-center gap-6 text-sm">
          <Link href="/actividades" className="text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)] transition-colors">
            Actividades
          </Link>
          <Link href="/mapa" className="text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)] transition-colors">
            Mapa
          </Link>

          {/* Toggle de tema — visible para todos los usuarios */}
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
  )
}
