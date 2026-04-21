// =============================================================================
// /perfil — Vista principal de perfil del usuario
//
// Arquitectura: destinos (nav en sidebar) vs acciones (botón contextual aquí).
// "Editar perfil" es un CTA principal en el header, no un ítem de navegación.
// =============================================================================

import type { Metadata } from 'next'
import { requireAuth, getOrCreateDbUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Tu cuenta | HabitaPlan',
  description: 'Tu información de perfil en HabitaPlan',
}

import { getAccountTypeLabel } from '@/lib/utils'

// ── Empty states por KPI ─────────────────────────────────────────────────────
const EMPTY_LABELS: Record<string, string> = {
  Favoritos: 'Aún no tienes favoritos',
  Hijos: 'Aún no has agregado niñas o niños',
  Calificaciones: 'Aún no tienes calificaciones',
}

export default async function PerfilPage() {
  const user = await requireAuth()

  // Obtener datos del usuario incluyendo ciudad (relación)
  const dbUser = await getOrCreateDbUser(user)
  const dbUserWithCity = await prisma.user.findUnique({
    where: { id: dbUser.id },
    select: {
      name: true,
      avatarUrl: true,
      city: { select: { name: true } },
    },
  })

  const [favoritesCount, childrenCount, ratingsCount] = await Promise.all([
    prisma.favorite.count({ where: { userId: dbUser.id } }),
    prisma.child.count({ where: { userId: dbUser.id } }),
    prisma.rating.count({ where: { userId: dbUser.id } }),
  ])

  const stats = [
    { label: 'Favoritos', count: favoritesCount, href: '/perfil/favoritos', icon: '❤️', ctaHref: '/actividades' },
    { label: 'Hijos', count: childrenCount, href: '/perfil/hijos', icon: '👶', ctaHref: '/perfil/hijos' },
    { label: 'Calificaciones', count: ratingsCount, href: '/perfil/calificaciones', icon: '⭐', ctaHref: '/actividades' },
  ]

  const displayName = dbUserWithCity?.name ?? user.user_metadata?.name ?? ''
  const avatarUrl = dbUserWithCity?.avatarUrl ?? (user.user_metadata?.avatar_url as string | undefined)
  const cityName = dbUserWithCity?.city?.name ?? null
  const currentRole = user.app_metadata?.role || 'parent'
  const displayRole = getAccountTypeLabel(currentRole)
  const initial = (displayName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* ── Header del perfil ──────────────────────────────────────────────
          Estructura: Avatar + datos | CTA "Editar perfil"
          El botón está visible sin scroll y es el único CTA principal.
      ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius-xl)] shadow-[var(--hp-shadow-sm)] p-6">
        <div className="flex items-start justify-between gap-4">

          {/* Avatar + datos */}
          <div className="flex items-center gap-4 min-w-0">
            {/* Avatar */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-[var(--hp-border)] shrink-0"
              />
            ) : (
              <div
                aria-hidden="true"
                className="w-16 h-16 rounded-full bg-brand-100 dark:bg-orange-900/30 text-brand-600 dark:text-orange-400 flex items-center justify-center text-2xl font-bold shrink-0 select-none"
              >
                {initial}
              </div>
            )}

            {/* Datos */}
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-[var(--hp-text-primary)] leading-tight truncate">
                {displayName || '—'}
              </h1>
              <p className="text-sm text-[var(--hp-text-secondary)] truncate mt-0.5">
                {user.email}
              </p>
              {cityName && (
                <p className="text-xs text-[var(--hp-text-muted)] mt-0.5">
                  📍 {cityName}
                </p>
              )}
              <span className="inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--hp-bg-subtle)] text-[var(--hp-text-secondary)]">
                {displayRole}
              </span>
            </div>
          </div>

          {/* CTA principal — único, visible sin scroll */}
          <Link
            href="/perfil/editar"
            className="
              shrink-0 inline-flex items-center gap-1.5 px-4 py-2
              bg-brand-500 hover:bg-brand-600 active:bg-brand-700
              text-white text-sm font-semibold
              rounded-[var(--hp-radius-md)]
              shadow-[var(--hp-shadow-sm)] hover:shadow-[var(--hp-shadow-md)]
              transition-colors duration-[var(--hp-transition)]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
            "
          >
            <EditIcon />
            Editar información
          </Link>
        </div>
      </div>
      {/* ── KPIs ───────────────────────────────────────────────────────────
          Empty state cuando count = 0: texto descriptivo + CTA secundario.
          No muestra "0" — muestra intención y siguiente paso.
      ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) =>
          stat.count > 0 ? (
            // Estado con datos — clic navega a la sección
            (<Link
              key={stat.href}
              href={stat.href}
              className="
                bg-[var(--hp-bg-surface)] border border-[var(--hp-border-subtle)]
                rounded-[var(--hp-radius-lg)] shadow-[var(--hp-shadow-sm)]
                p-5 hover:border-brand-300 hover:shadow-[var(--hp-shadow-md)]
                transition-all duration-[var(--hp-transition)] group
              "
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{stat.icon}</span>
                <span className="text-2xl font-bold text-[var(--hp-text-primary)]">
                  {stat.count}
                </span>
              </div>
              <p className="text-sm text-[var(--hp-text-secondary)] group-hover:text-[var(--hp-text-primary)] transition-colors">
                {stat.label}
              </p>
            </Link>)
          ) : (
            // Empty state — texto + CTA para explorar
            (<div
              key={stat.href}
              className="
                bg-[var(--hp-bg-subtle)] border border-dashed border-[var(--hp-border)]
                rounded-[var(--hp-radius-lg)]
                p-5 flex flex-col gap-2
              "
            >
              <span className="text-2xl opacity-40">{stat.icon}</span>
              <p className="text-sm text-[var(--hp-text-muted)]">
                {EMPTY_LABELS[stat.label]}
              </p>
              {stat.label === 'Favoritos' && (
                <Link
                  href={stat.ctaHref}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium mt-0.5"
                >
                  Explorar actividades →
                </Link>
              )}
            </div>)
          )
        )}
      </div>
    </div>
  );
}

// ── Ícono de edición (SVG inline, 0 deps) ────────────────────────────────────
function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}
