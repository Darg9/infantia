'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type Status = 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'EXPIRED'

interface Activity {
  id: string
  title: string
  status: Status
  type: string
  audience: string
  price: number | null
  createdAt: string
  provider: { name: string } | null
  categories: { category: { name: string } }[]
}

const STATUS_LABELS: Record<Status, string> = {
  ACTIVE: 'Activa',
  PAUSED: 'Oculta',
  DRAFT: 'Borrador',
  EXPIRED: 'Expirada',
}

const STATUS_COLORS: Record<Status, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  PAUSED: 'bg-warning-100 text-warning-700',
  DRAFT: 'bg-gray-100 text-gray-600',
  EXPIRED: 'bg-error-100 text-error-600',
}

export default function AdminActividadesPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Status | ''>('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const PAGE_SIZE = 20

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    })
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)

    const res = await fetch(`/api/activities?${params}`)
    if (res.ok) {
      const data = await res.json()
      setActivities(data.data?.activities ?? [])
      setTotal(data.data?.total ?? 0)
    }
    setLoading(false)
  }, [page, search, statusFilter])

  useEffect(() => { load() }, [load])

  async function toggleStatus(activity: Activity) {
    const newStatus: Status = activity.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    setBusy(activity.id)
    const res = await fetch(`/api/admin/activities/${activity.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setActivities((prev) =>
        prev.map((a) => a.id === activity.id ? { ...a, status: newStatus } : a)
      )
    }
    setBusy(null)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← Admin</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Gestión de actividades</h1>
          <p className="text-sm text-gray-500">{total} actividades en total</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Buscar por título..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm w-64 focus:outline-none focus:border-orange-400"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as Status | ''); setPage(1) }}
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-orange-400"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activas</option>
          <option value="PAUSED">Ocultas</option>
          <option value="DRAFT">Borradores</option>
          <option value="EXPIRED">Expiradas</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No hay actividades</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Título</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Proveedor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Precio</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activities.map((act) => (
                <tr key={act.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 max-w-xs">
                    <span className="font-medium text-gray-900 line-clamp-1">{act.title}</span>
                    {act.categories[0] && (
                      <span className="text-xs text-gray-400">{act.categories[0].category.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate">
                    {act.provider?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[act.status]}`}>
                      {STATUS_LABELS[act.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{act.type}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {act.price === null ? '—' : act.price === 0 ? 'Gratis' : `$${Number(act.price).toLocaleString('es-CO')}`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/actividades/${act.id}/editar`}
                        className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-600 transition-colors"
                      >
                        Editar
                      </Link>
                      {(act.status === 'ACTIVE' || act.status === 'PAUSED') && (
                        <button
                          onClick={() => toggleStatus(act)}
                          disabled={busy === act.id}
                          className={`text-xs px-3 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
                            act.status === 'ACTIVE'
                              ? 'border-amber-200 text-warning-600 hover:bg-amber-50'
                              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {busy === act.id ? '...' : act.status === 'ACTIVE' ? 'Ocultar' : 'Activar'}
                        </button>
                      )}
                      <Link
                        href={`/actividades/${act.id}`}
                        target="_blank"
                        className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Ver
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:border-orange-400 transition-colors"
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-500">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:border-orange-400 transition-colors"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
