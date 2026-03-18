import { requireAuth } from '@/lib/auth'
import Link from 'next/link'

export default async function PerfilPage() {
  const user = await requireAuth()

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi perfil</h1>

      {/* Datos de cuenta */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Nombre</p>
          <p className="text-gray-900 mt-1">{user.user_metadata?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Correo</p>
          <p className="text-gray-900 mt-1">{user.email}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Rol</p>
          <p className="text-gray-900 mt-1 capitalize">
            {user.app_metadata?.role ?? 'parent'}
          </p>
        </div>
      </div>

      {/* Mis hijos */}
      <Link
        href="/perfil/hijos"
        className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-6 py-4 hover:border-orange-300 transition-colors group"
      >
        <div>
          <p className="font-medium text-gray-900 group-hover:text-orange-600 transition-colors">
            Mis hijos
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Perfiles de menores para personalizar la búsqueda de actividades
          </p>
        </div>
        <span className="text-gray-400 group-hover:text-orange-500 transition-colors">→</span>
      </Link>
    </div>
  )
}
