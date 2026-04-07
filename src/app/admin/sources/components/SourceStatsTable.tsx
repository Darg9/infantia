'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SourceStat {
  id: string;
  name: string;
  platform: string;
  cityName: string | null;
  cityId: string | null;
  urlScore: number | null;
  lowScoreCount: number;
  highScoreCount: number;
  totalUrls: number;
  lastScanned: string | null;
  paused: boolean;
  pausedAt: string | null;
  pausedReason: string | null;
  pauseThreshold: number;
  pauseDurationDays: number;
  isActive: boolean;
}

interface SourceStatsSummary {
  total: number;
  active: number;
  paused: number;
  lowQuality: number;
}

export function SourceStatsTable({ cityId }: { cityId?: string }) {
  const [stats, setStats] = useState<SourceStat[]>([]);
  const [summary, setSummary] = useState<SourceStatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (cityId) params.append('cityId', cityId);

        const response = await fetch(`/api/admin/sources/url-stats?${params}`);
        if (!response.ok) throw new Error('Failed to fetch stats');

        const data = await response.json();
        setStats(data.sources);
        setSummary(data.summary);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [cityId]);

  if (loading) return <div className="text-center py-8 text-gray-500">Cargando estadísticas...</div>;

  if (error)
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
    );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-2xl font-bold text-blue-600">{summary.total}</p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Activas</p>
            <p className="text-2xl font-bold text-green-600">{summary.active}</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Pausadas</p>
            <p className="text-2xl font-bold text-amber-600">{summary.paused}</p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Baja calidad</p>
            <p className="text-2xl font-bold text-red-600">{summary.lowQuality}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Fuente</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Plataforma</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">URL Score</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">URLs</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stats.map((source) => {
              const scoreColor =
                source.urlScore === null
                  ? 'text-gray-400'
                  : source.urlScore >= 60
                    ? 'text-green-600'
                    : source.urlScore >= 45
                      ? 'text-amber-600'
                      : 'text-red-600';

              const isLowQuality = source.urlScore !== null && source.urlScore < 45;

              return (
                <tr key={`${source.id}-${source.cityId}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{source.name}</p>
                      {source.cityName && <p className="text-xs text-gray-500">{source.cityName}</p>}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-gray-600">{source.platform}</td>

                  <td className="px-4 py-3 text-center">
                    {source.urlScore !== null ? (
                      <div>
                        <p className={`font-semibold ${scoreColor}`}>{source.urlScore}/100</p>
                        {isLowQuality && <p className="text-xs text-red-500">⚠️ Baja calidad</p>}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-xs">Sin datos</p>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-gray-600">{source.totalUrls}</td>

                  <td className="px-4 py-3 text-center">
                    {source.paused ? (
                      <div className="inline-block bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-medium">
                        ⏸️ Pausada
                        {source.pausedAt && (
                          <p className="text-xs text-amber-600">
                            {new Date(source.pausedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="inline-block bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">
                        ✅ Activa
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/sources/${source.id}`}
                      className="text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Ver detalles →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {stats.length === 0 && (
        <div className="text-center py-8 text-gray-400">No hay fuentes disponibles</div>
      )}
    </div>
  );
}
