import { requireAuth, getOrCreateDbUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'

export default async function PerfilPage() {
  const user = await requireAuth()

  const dbUser = await getOrCreateDbUser(user)

  const [favoritesCount, childrenCount, ratingsCount] = await Promise.all([
    prisma.favorite.count({ where: { userId: dbUser.id } }),
    prisma.child.count({ where: { userId: dbUser.id } }),
    prisma.rating.count({ where: { userId: dbUser.id } }),
  ])

  const stats = [
    { label: 'Favoritos', count: favoritesCount, href: '/perfil/favoritos', icon: '❤️', color: 'rose' },
    { label: 'Hijos', count: childrenCount, href: '/perfil/hijos', icon: '👶', color: 'orange' },
    { label: 'Calificaciones', count: ratingsCount, href: '/perfil/calificaciones', icon: '⭐', color: 'amber' },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi perfil</h1>

      {/* Datos de cuenta */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 mb-6">
        <div>
          <p className="text-xs text-gray-500 tracking-wide font-medium">Nombre</p>
          <p className="text-gray-900 mt-1">{dbUser?.name ?? user.user_metadata?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 tracking-wide font-medium">Correo</p>
          <p className="text-gray-900 mt-1">{user.email}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 tracking-wide font-medium">Rol</p>
          <p className="text-gray-900 mt-1 capitalize">
            {user.app_metadata?.role ?? 'parent'}
          </p>
        </div>
        <Link
          href="/perfil/editar"
          className="inline-block text-sm text-brand-600 hover:text-orange-700 font-medium"
        >
          Editar perfil →
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.href}
            href={stat.href}
            className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-orange-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{stat.icon}</span>
              <span className="text-2xl font-bold text-gray-900">{stat.count}</span>
            </div>
            <p className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">
              {stat.label}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
