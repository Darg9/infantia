'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Status = 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'EXPIRED'
type Audience = 'KIDS' | 'FAMILY' | 'ADULTS' | 'ALL'

interface ActivityDetail {
  id: string
  title: string
  description: string | null
  status: Status
  audience: Audience
  price: number | null
  ageMin: number | null
  ageMax: number | null
  type: string
  sourceUrl: string | null
  provider: { name: string } | null
  categories: { category: { name: string } }[]
}

export default function EditarActividadPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [activity, setActivity] = useState<ActivityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<Status>('ACTIVE')
  const [audience, setAudience] = useState<Audience>('ALL')
  const [price, setPrice] = useState('')
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')

  useEffect(() => {
    fetch(`/api/activities/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const act = data.data as ActivityDetail
        setActivity(act)
        setTitle(act.title)
        setDescription(act.description ?? '')
        setStatus(act.status)
        setAudience(act.audience)
        setPrice(act.price !== null ? String(act.price) : '')
        setAgeMin(act.ageMin !== null ? String(act.ageMin) : '')
        setAgeMax(act.ageMax !== null ? String(act.ageMax) : '')
      })
      .finally(() => setLoading(false))
  }, [id])

  async function save() {
    setSaving(true)
    setMsg(null)

    const body: Record<string, unknown> = { title, description, status, audience }
    body.price = price !== '' ? Number(price) : null
    body.ageMin = ageMin !== '' ? Number(ageMin) : null
    body.ageMax = ageMax !== '' ? Number(ageMax) : null

    const res = await fetch(`/api/admin/activities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      setMsg({ type: 'success', text: 'Actividad actualizada' })
    } else {
      const data = await res.json()
      setMsg({ type: 'error', text: data.error ?? 'Error al guardar' })
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded-xl w-1/2" />
          <div className="h-40 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-gray-500">
        Actividad no encontrada.{' '}
        <Link href="/admin/actividades" className="text-brand-500 underline">Volver</Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4 space-x-1">
        <Link href="/admin" className="hover:text-gray-700">Admin</Link>
        <span>›</span>
        <Link href="/admin/actividades" className="hover:text-gray-700">Actividades</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Editar</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Editar actividad</h1>
      {activity.provider && (
        <p className="text-sm text-gray-400 mb-6">Proveedor: {activity.provider.name}</p>
      )}

      {msg && (
        <div className={`text-sm px-4 py-3 rounded-xl mb-5 ${
          msg.type === 'success'
            ? 'bg-success-50 border border-success-200 text-success-700'
            : 'bg-error-50 border border-error-200 text-error-600'
        }`}>
          {msg.text}
          {msg.type === 'success' && (
            <button
              onClick={() => router.push('/admin/actividades')}
              className="ml-3 underline text-success-700"
            >
              Volver a la lista
            </button>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">

        {/* Título */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-400"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-400 resize-none"
          />
        </div>

        {/* Estado y Audiencia */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-400"
            >
              <option value="ACTIVE">Activa</option>
              <option value="PAUSED">Oculta (pausada)</option>
              <option value="DRAFT">Borrador</option>
              <option value="EXPIRED">Expirada</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Audiencia</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-400"
            >
              <option value="ALL">Todos</option>
              <option value="KIDS">Niños</option>
              <option value="FAMILY">Familia</option>
              <option value="ADULTS">Adultos</option>
            </select>
          </div>
        </div>

        {/* Precio y edades */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio (COP)</label>
            <input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0 = Gratis"
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Edad mín.</label>
            <input
              type="number"
              min="0"
              max="120"
              value={ageMin}
              onChange={(e) => setAgeMin(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Edad máx.</label>
            <input
              type="number"
              min="0"
              max="120"
              value={ageMax}
              onChange={(e) => setAgeMax(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-400"
            />
          </div>
        </div>

        {/* Info de solo lectura */}
        <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-xs text-gray-400">
          <div><span className="font-medium text-gray-500">Tipo:</span> {activity.type}</div>
          <div>
            <span className="font-medium text-gray-500">Categorías:</span>{' '}
            {activity.categories.map((c) => c.category.name).join(', ') || '—'}
          </div>
          {activity.sourceUrl && (
            <div className="col-span-2">
              <span className="font-medium text-gray-500">Fuente:</span>{' '}
              <a href={activity.sourceUrl} target="_blank" className="text-brand-500 underline truncate" rel="noreferrer">
                {activity.sourceUrl}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Botones */}
      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <Link
          href="/admin/actividades"
          className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:border-gray-300 transition-colors"
        >
          Cancelar
        </Link>
        <Link
          href={`/actividades/${id}`}
          target="_blank"
          className="ml-auto text-sm text-gray-400 hover:text-gray-600 underline"
        >
          Ver pública →
        </Link>
      </div>
    </div>
  )
}
