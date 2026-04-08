import { requireRole } from '@/lib/auth'
import { UserRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { InstagramConfig } from './_components/InstagramConfig'
import { SourceToggle } from './_components/SourceToggle'

export default async function ScrapingSourcesPage() {
  await requireRole([UserRole.ADMIN])

  const sources = await prisma.scrapingSource.findMany({
    include: {
      city: { select: { name: true, countryCode: true } },
      vertical: { select: { name: true } },
      _count: { select: { logs: true } },
    },
    orderBy: { lastRunAt: { sort: 'desc', nulls: 'last' } },
  })

  const platformEmoji: Record<string, string> = {
    WEBSITE: '🌐',
    INSTAGRAM: '📸',
    FACEBOOK: '📘',
    TELEGRAM: '✈️',
    TIKTOK: '🎵',
    X: '🐦',
    WHATSAPP: '💬',
  }

  const statusColor: Record<string, string> = {
    SUCCESS: 'bg-green-100 text-green-700',
    PARTIAL: 'bg-yellow-100 text-yellow-700',
    FAILED: 'bg-red-100 text-red-700',
    RUNNING: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/admin" className="text-sm text-orange-600 hover:underline mb-2 inline-block">
            &larr; Panel admin
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Fuentes de scraping</h1>
          <p className="text-gray-500 text-sm mt-1">{sources.length} fuentes configuradas</p>
        </div>
      </div>

      {sources.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <p className="text-gray-400 text-lg">No hay fuentes configuradas</p>
          <p className="text-gray-400 text-sm mt-1">Las fuentes se crean al ejecutar el pipeline con ScrapingLogger</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sources.map((source) => (
            <div
              key={source.id}
              className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-gray-300 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{platformEmoji[source.platform] ?? '🔗'}</span>
                    <h2 className="font-semibold text-gray-900">{source.name}</h2>
                    {source.isActive ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Activa</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactiva</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate max-w-lg">{source.url}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                    <span>{source.city.name}, {source.city.countryCode}</span>
                    <span>{source.vertical.name}</span>
                    <span>Cron: {source.scheduleCron}</span>
                    <span>{source._count.logs} ejecuciones</span>
                  </div>
                </div>

                <div className="text-right ml-4">
                  {source.lastRunAt ? (
                    <>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${statusColor[source.lastRunStatus ?? ''] ?? 'bg-gray-100 text-gray-500'}`}
                      >
                        {source.lastRunStatus ?? '—'}
                      </span>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(source.lastRunAt).toLocaleDateString('es-CO', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {source.lastRunItems != null && (
                        <p className="text-xs text-gray-500 mt-1">{source.lastRunItems} items</p>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">Sin ejecuciones</span>
                  )}
                </div>
                {/* Toggle activa/inactiva */}
                <div className="flex items-center gap-2 ml-4 mt-1">
                  <SourceToggle
                    sourceId={source.id}
                    sourceName={source.name}
                    isActive={source.isActive}
                  />
                </div>

                {/* Config Instagram — solo para fuentes de Instagram */}
                {source.platform === 'INSTAGRAM' && (
                  <InstagramConfig
                    sourceId={source.id}
                    initialConfig={source.config as Record<string, unknown> | null}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
