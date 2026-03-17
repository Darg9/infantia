import { requireRole } from '@/lib/auth'
import { UserRole } from '@/generated/prisma/client'
import Link from 'next/link'

export default async function AdminPage() {
  await requireRole([UserRole.ADMIN])

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Panel de administración</h1>
      <p className="text-gray-500 mb-8">Infantia Admin — versión inicial</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/admin/scraping/sources"
          className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-orange-300 hover:shadow-sm transition-all"
        >
          <div className="text-2xl mb-2">🕷️</div>
          <h2 className="font-semibold text-gray-900">Fuentes de scraping</h2>
          <p className="text-sm text-gray-500 mt-1">Ver estado de las fuentes configuradas</p>
        </Link>

        <Link
          href="/admin/scraping/logs"
          className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-orange-300 hover:shadow-sm transition-all"
        >
          <div className="text-2xl mb-2">📋</div>
          <h2 className="font-semibold text-gray-900">Logs de ejecución</h2>
          <p className="text-sm text-gray-500 mt-1">Historial de scraping y resultados</p>
        </Link>

        <Link
          href="/actividades"
          className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-orange-300 hover:shadow-sm transition-all"
        >
          <div className="text-2xl mb-2">🎯</div>
          <h2 className="font-semibold text-gray-900">Actividades</h2>
          <p className="text-sm text-gray-500 mt-1">Ver el catálogo público de actividades</p>
        </Link>
      </div>
    </div>
  )
}
