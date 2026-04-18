// =============================================================================
// /proveedores/[slug]/dashboard — Panel interno del proveedor (solo ADMIN)
// =============================================================================

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getSessionWithRole } from '@/lib/auth'

type PageProps = { params: Promise<{ slug: string }> }

async function getProviderData(slug: string) {
  const provider = await prisma.provider.findUnique({
    where: { slug },
    include: {
      activities: {
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: {
          _count: { select: { views: true } },
          location: { select: { name: true, city: { select: { name: true } } } },
        },
      },
    },
  })
  return provider
}

export default async function ProviderDashboardPage({ params }: PageProps) {
  const session = await getSessionWithRole()
  if (!session) redirect('/login')

  const { slug } = await params
  const provider = await getProviderData(slug)

  const isAdmin = session.role === 'admin'
  const isOwner =
    session.role === 'provider' &&
    provider?.email != null &&
    provider.email === session.user.email

  if (!isAdmin && !isOwner) redirect('/')

  if (!provider) notFound()

  const totalViews = provider.activities.reduce((sum, a) => sum + a._count.views, 0)
  const activeCount = provider.activities.filter((a) => a.status === 'ACTIVE').length
  const expiredCount = provider.activities.filter((a) => a.status === 'EXPIRED').length
  const draftCount = provider.activities.filter((a) => a.status === 'DRAFT').length

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--hp-text-primary)]">{provider.name}</h1>
          <p className="text-sm text-[var(--hp-text-secondary)] mt-1">
            Dashboard interno · slug: <code className="bg-gray-100 px-1 rounded">{provider.slug}</code>
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/proveedores/${slug}`}
            className="text-sm text-indigo-600 hover:underline"
          >
            Ver perfil público →
          </Link>
          <span className="text-[var(--hp-text-muted)]">|</span>
          <Link href="/admin" className="text-sm text-[var(--hp-text-secondary)] hover:underline">
            ← Admin
          </Link>
        </div>
      </div>

      {/* Estado premium */}
      <div className={`rounded-2xl border p-4 mb-6 flex items-center gap-3 ${provider.isPremium ? 'bg-warning-50 border-warning-200' : 'bg-[var(--hp-bg-page)] border-[var(--hp-border)]'}`}>
        <span className="text-2xl">{provider.isPremium ? '⭐' : '🏷️'}</span>
        <div>
          <p className="font-semibold text-[var(--hp-text-primary)]">
            {provider.isPremium ? 'Proveedor Destacado (Premium)' : 'Proveedor Estándar'}
          </p>
          {provider.isPremium && provider.premiumSince && (
            <p className="text-xs text-warning-700">
              Premium desde {new Date(provider.premiumSince).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          )}
          {!provider.isPremium && (
            <p className="text-xs text-[var(--hp-text-secondary)]">Las actividades Destacadas aparecen primero en búsquedas por relevancia.</p>
          )}
        </div>
      </div>

      {/* Métricas resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Vistas totales', value: totalViews, color: 'indigo' },
          { label: 'Activas', value: activeCount, color: 'emerald' },
          { label: 'Expiradas', value: expiredCount, color: 'gray' },
          { label: 'Borradores', value: draftCount, color: 'orange' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl p-4 text-center">
            <p className={`text-2xl font-bold text-${color}-600`}>{value}</p>
            <p className="text-xs text-[var(--hp-text-secondary)] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Lista de actividades */}
      <div className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--hp-border)]">
          <h2 className="font-semibold text-[var(--hp-text-primary)]">Actividades ({provider.activities.length})</h2>
        </div>
        {provider.activities.length === 0 ? (
          <p className="text-center text-[var(--hp-text-muted)] py-10 text-sm">No hay actividades para este proveedor.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--hp-bg-page)] text-xs text-[var(--hp-text-secondary)]">
              <tr>
                <th className="px-6 py-3 text-left">Actividad</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Ciudad</th>
                <th className="px-4 py-3 text-right">Vistas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {provider.activities.map((a) => (
                <tr key={a.id} className="hover:bg-[var(--hp-bg-page)] transition-colors">
                  <td className="px-6 py-3">
                    <Link
                      href={`/actividades/${a.id}`}
                      className="text-[var(--hp-text-primary)] font-medium hover:text-indigo-600 line-clamp-1"
                    >
                      {a.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      a.status === 'ACTIVE'  ? 'bg-emerald-100 text-emerald-700' :
                      a.status === 'DRAFT'   ? 'bg-brand-100 text-brand-700' :
                      a.status === 'PAUSED'  ? 'bg-warning-100 text-warning-700' :
                                               'bg-gray-100 text-[var(--hp-text-secondary)]'
                    }`}>
                      {a.status === 'ACTIVE' ? 'Activa' : a.status === 'DRAFT' ? 'Borrador' : a.status === 'PAUSED' ? 'Pausada' : 'Expirada'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--hp-text-secondary)]">
                    {a.location?.city?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[var(--hp-text-primary)]">
                    {a._count.views.toLocaleString('es-CO')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
