import { requireRole } from '@/lib/auth'
import { UserRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/db'
import Link from 'next/link'

export default async function ScrapingLogsPage() {
  await requireRole([UserRole.ADMIN])

  const logs = await prisma.scrapingLog.findMany({
    include: {
      source: { select: { name: true, platform: true, url: true } },
    },
    orderBy: { startedAt: 'desc' },
    take: 50,
  })

  const statusStyle: Record<string, { bg: string; icon: string }> = {
    SUCCESS: { bg: 'bg-success-100 text-success-700', icon: '✅' },
    PARTIAL: { bg: 'bg-warning-100 text-warning-700', icon: '⚠️' },
    FAILED: { bg: 'bg-error-100 text-error-700', icon: '❌' },
    RUNNING: { bg: 'bg-blue-100 text-blue-700', icon: '🔄' },
  }

  const platformEmoji: Record<string, string> = {
    WEBSITE: '🌐',
    INSTAGRAM: '📸',
    FACEBOOK: '📘',
    TELEGRAM: '✈️',
    TIKTOK: '🎵',
    X: '🐦',
    WHATSAPP: '💬',
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link href="/admin" className="text-sm text-brand-600 hover:underline mb-2 inline-block">
          &larr; Panel admin
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Logs de ejecucion</h1>
        <p className="text-gray-500 text-sm mt-1">Ultimas {logs.length} ejecuciones del pipeline</p>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <p className="text-gray-400 text-lg">No hay logs todavia</p>
          <p className="text-gray-400 text-sm mt-1">
            Los logs se generan cuando el pipeline usa ScrapingLogger
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Fuente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Inicio</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Encontradas</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Nuevas</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Duplicadas</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Duracion</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const style = statusStyle[log.status] ?? { bg: 'bg-gray-100 text-gray-500', icon: '—' }
                const duration =
                  log.finishedAt && log.startedAt
                    ? Math.round((new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime()) / 1000)
                    : null

                return (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${style.bg}`}>
                        {style.icon} {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span>{platformEmoji[log.source.platform] ?? '🔗'}</span>
                        <span className="font-medium text-gray-900">{log.source.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(log.startedAt).toLocaleDateString('es-CO', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{log.itemsFound}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{log.itemsNew}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{log.itemsDuplicated}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {duration != null ? (
                        duration >= 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {logs.some((l) => l.errorMessage) && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Errores recientes</h2>
          <div className="space-y-3">
            {logs
              .filter((l) => l.errorMessage)
              .slice(0, 5)
              .map((log) => (
                <div key={log.id} className="bg-error-50 border border-error-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-error-700 text-sm">{log.source.name}</span>
                    <span className="text-xs text-error-400">
                      {new Date(log.startedAt).toLocaleDateString('es-CO')}
                    </span>
                  </div>
                  <p className="text-sm text-error-600 font-mono">{log.errorMessage}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
