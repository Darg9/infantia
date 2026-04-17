import { requireRole } from '@/lib/auth'
import { UserRole } from '@/generated/prisma/client'
import Link from 'next/link'

export default async function AdminPage() {
  await requireRole([UserRole.ADMIN])

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Panel de administración</h1>
      <p className="text-gray-500 mb-8">HabitaPlan Admin — versión inicial</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/admin/scraping/sources"
          className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-brand-300 hover:shadow-sm transition-all"
        >
          <div className="text-2xl mb-2">🕷️</div>
          <h2 className="font-semibold text-gray-900">Fuentes de scraping</h2>
          <p className="text-sm text-gray-500 mt-1">Ver estado de las fuentes configuradas</p>
        </Link>

        <Link
          href="/admin/scraping/logs"
          className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-brand-300 hover:shadow-sm transition-all"
        >
          <div className="text-2xl mb-2">📋</div>
          <h2 className="font-semibold text-gray-900">Logs de ejecución</h2>
          <p className="text-sm text-gray-500 mt-1">Historial de scraping y resultados</p>
        </Link>

        <Link
          href="/admin/actividades"
          className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-brand-300 hover:shadow-sm transition-all"
        >
          <div className="text-2xl mb-2">🎯</div>
          <h2 className="font-semibold text-gray-900">Gestión de actividades</h2>
          <p className="text-sm text-gray-500 mt-1">Editar, ocultar y revisar actividades</p>
        </Link>

        <Link
          href="/admin/metricas"
          className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-brand-300 hover:shadow-sm transition-all"
        >
          <div className="text-2xl mb-2">📊</div>
          <h2 className="font-semibold text-gray-900">Métricas</h2>
          <p className="text-sm text-gray-500 mt-1">Vistas, búsquedas frecuentes y distribución</p>
        </Link>

        <Link
          href="/admin/sponsors"
          className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-warning-300 hover:shadow-sm transition-all"
        >
          <div className="text-2xl mb-2">💛</div>
          <h2 className="font-semibold text-gray-900">Patrocinadores</h2>
          <p className="text-sm text-gray-500 mt-1">Gestiona sponsors para el newsletter</p>
        </Link>

        <Link
          href="/admin/claims"
          className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-brand-300 hover:shadow-sm transition-all"
        >
          <div className="text-2xl mb-2">✋</div>
          <h2 className="font-semibold text-gray-900">Solicitudes de perfil</h2>
          <p className="text-sm text-gray-500 mt-1">Aprueba o rechaza reclamaciones de proveedores</p>
        </Link>

        <Link
          href="/admin/sources"
          className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-brand-300 hover:shadow-sm transition-all"
        >
          <div className="text-2xl mb-2">📈</div>
          <h2 className="font-semibold text-gray-900">URL Score Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Monitoreo de calidad y auto-pause de fuentes</p>
        </Link>
        
        <Link
          href="/admin/quality"
          className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-brand-300 hover:shadow-sm transition-all"
        >
          <div className="text-2xl mb-2">🛡️</div>
          <h2 className="font-semibold text-gray-900">Content Quality</h2>
          <p className="text-sm text-gray-500 mt-1">Monitor de pipeline: ruido, longitud y alertas</p>
        </Link>

        <Link
          href="/admin/cities/review"
          className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-brand-300 hover:shadow-sm transition-all"
        >
          <div className="text-2xl mb-2">🗺️</div>
          <h2 className="font-semibold text-gray-900">Revisión de ciudades</h2>
          <p className="text-sm text-gray-500 mt-1">Resuelve ambigüedades de ciudad con baja confianza</p>
        </Link>

        <Link
          href="/admin/preflight"
          className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-brand-300 hover:shadow-sm transition-all"
        >
          <div className="text-2xl mb-2">🗓️</div>
          <h2 className="font-semibold text-gray-900">Date Preflight</h2>
          <p className="text-sm text-gray-500 mt-1">Análisis de filtrado previo a Gemini por rango de fechas</p>
        </Link>
      </div>
    </div>
  )
}
