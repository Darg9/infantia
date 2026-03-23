'use client'

import Link from 'next/link'
import { useActivityHistory } from '@/hooks/useActivityHistory'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Ahora mismo'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `Hace ${days}d`
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  })
}

export default function HistorialPage() {
  const { history, clearHistory } = useActivityHistory()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Historial</h1>
          {history.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
              {history.length}
            </span>
          )}
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Borrar historial
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <span className="text-6xl">🕐</span>
          <p className="text-gray-600 font-medium text-lg">No has visto actividades recientemente</p>
          <p className="text-sm text-gray-400 max-w-sm">
            Cuando visites una actividad, aparecera aqui para que puedas volver a encontrarla.
          </p>
          <Link
            href="/actividades"
            className="mt-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Explorar actividades
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => (
            <Link
              key={entry.activityId}
              href={`/actividades/${entry.activityId}`}
              className="flex items-center gap-4 bg-white border border-gray-200 rounded-2xl p-3 hover:border-orange-300 transition-colors group"
            >
              {entry.imageUrl ? (
                <img
                  src={entry.imageUrl}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-xl shrink-0">
                  🎨
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 group-hover:text-orange-600 transition-colors truncate">
                  {entry.title}
                </p>
                <p className="text-xs text-gray-400">{timeAgo(entry.viewedAt)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
