// =============================================================================
// /proveedores/[slug] — Página pública de un proveedor
// =============================================================================

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/db'
import ActivityCard from '@/app/actividades/_components/ActivityCard'
import ClaimButton from '@/components/ClaimButton'

const TYPE_LABELS: Record<string, string> = {
  ACADEMY:     'Academia',
  INDEPENDENT: 'Independiente',
  INSTITUTION: 'Institución',
  GOVERNMENT:  'Entidad pública',
}

type PageProps = { params: Promise<{ slug: string }> }

async function getProvider(slug: string) {
  return prisma.provider.findUnique({
    where: { slug },
    include: {
      activities: {
        where: { status: { in: ['ACTIVE', 'EXPIRED'] } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 50,
        include: {
          categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
          location: {
            select: {
              name: true,
              address: true,
              neighborhood: true,
              city: { select: { id: true, name: true } },
            },
          },
          provider: { select: { id: true, name: true, slug: true, type: true, logoUrl: true, isVerified: true, isPremium: true } },
        },
      },
      _count: { select: { activities: true } },
    },
  })
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const provider = await getProvider(slug)
  if (!provider) return {}

  const title = `${provider.name} | HabitaPlan`
  const description =
    provider.description?.slice(0, 160) ??
    `${provider.name} — ${provider._count.activities} actividades en HabitaPlan`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(provider.logoUrl && { images: [{ url: provider.logoUrl }] }),
    },
  }
}

export default async function ProveedorPage({ params }: PageProps) {
  const { slug } = await params
  const provider = await getProvider(slug)

  if (!provider) notFound()

  const activeActivities = provider.activities.filter((a) => a.status === 'ACTIVE')
  const expiredActivities = provider.activities.filter((a) => a.status === 'EXPIRED')

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6">
        <Link href="/actividades" className="hover:text-gray-600">Actividades</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-700">{provider.name}</span>
      </nav>

      {/* Header del proveedor */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 flex gap-5 items-start">
        {/* Logo */}
        {provider.logoUrl ? (
          <div className="shrink-0">
            <Image
              src={provider.logoUrl}
              alt={provider.name}
              width={72}
              height={72}
              className="rounded-2xl object-cover"
            />
          </div>
        ) : (
          <div className="shrink-0 w-[72px] h-[72px] rounded-2xl bg-orange-50 flex items-center justify-center text-3xl select-none">
            🏫
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-gray-900">{provider.name}</h1>
            {provider.isVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                ✓ Verificado
              </span>
            )}
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {TYPE_LABELS[provider.type] ?? provider.type}
            </span>
          </div>

          {provider.description && (
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              {provider.description}
            </p>
          )}

          {/* Estadísticas */}
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
            <span>
              <strong className="text-gray-800">{activeActivities.length}</strong> actividades activas
            </span>
            {(provider.ratingAvg ?? 0) > 0 && (
              <span>
                ⭐ <strong className="text-gray-800">{provider.ratingAvg!.toFixed(1)}</strong>
                <span className="text-gray-400 ml-1">({provider.ratingCount})</span>
              </span>
            )}
          </div>

          {/* Links de contacto */}
          <div className="flex flex-wrap gap-2 mt-4">
            {!provider.isClaimed && provider.slug && (
              <ClaimButton providerSlug={provider.slug} />
            )}
            {provider.website && (
              <a href={provider.website} target="_blank" rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-600 transition-colors">
                🌐 Sitio web
              </a>
            )}
            {provider.instagram && (
              <a href={`https://instagram.com/${provider.instagram.replace('@', '')}`} target="_blank" rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-600 transition-colors">
                📷 Instagram
              </a>
            )}
            {provider.facebook && (
              <a href={provider.facebook} target="_blank" rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-600 transition-colors">
                👥 Facebook
              </a>
            )}
            {provider.email && (
              <a href={`mailto:${provider.email}`}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-600 transition-colors">
                ✉️ {provider.email}
              </a>
            )}
            {provider.phone && (
              <a href={`tel:${provider.phone}`}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-600 transition-colors">
                📞 {provider.phone}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Actividades activas */}
      {activeActivities.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Actividades ({activeActivities.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={{
                  ...activity,
                  description: activity.description ?? '',
                  price: activity.price !== null ? Number(activity.price) : null,
                }}
                isFavorited={false}
              />
            ))}
          </div>
        </section>
      )}

      {/* Actividades anteriores */}
      {expiredActivities.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-400 mb-4">
            Anteriores ({expiredActivities.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
            {expiredActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={{
                  ...activity,
                  description: activity.description ?? '',
                  price: activity.price !== null ? Number(activity.price) : null,
                }}
                isFavorited={false}
              />
            ))}
          </div>
        </section>
      )}

      {/* Estado vacío */}
      {provider.activities.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm">Este proveedor no tiene actividades publicadas aún.</p>
          <Link href="/actividades" className="mt-4 inline-block text-sm text-orange-500 underline">
            Ver todas las actividades
          </Link>
        </div>
      )}
    </main>
  )
}
