import { getErrorMessage } from '../../../../lib/error';
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
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [cityId]);

  if (loading) return <div className="text-center py-8 text-[var(--hp-text-secondary)]">Cargando estadísticas...</div>;

  if (error)
    return (
      <div className="bg-error-50 border border-error-200 rounded-lg p-4 text-error-700">{error}</div>
    );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-brand-50 border border-brand-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-2xl font-bold text-brand-600">{summary.total}</p>
          </div>

          <div className="bg-success-50 border border-success-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Activas</p>
            <p className="text-2xl font-bold text-success-600">{summary.active}</p>
          </div>

          <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Pausadas</p>
            <p className="text-2xl font-bold text-warning-600">{summary.paused}</p>
          </div>

          <div className="bg-error-50 border border-error-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Baja calidad</p>
            <p className="text-2xl font-bold text-error-600">{summary.lowQuality}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--hp-bg-page)] border-b border-[var(--hp-border)]">
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
                  ? 'text-[var(--hp-text-muted)]'
                  : source.urlScore >= 60
                    ? 'text-success-600'
                    : source.urlScore >= 45
                      ? 'text-warning-600'
                      : 'text-error-600';

              const isLowQuality = source.urlScore !== null && source.urlScore < 45;

              return (
                <tr key={`${source.id}-${source.cityId}`} className="hover:bg-[var(--hp-bg-page)]">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-[var(--hp-text-primary)]">{source.name}</p>
                      {source.cityName && <p className="text-xs text-[var(--hp-text-secondary)]">{source.cityName}</p>}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-gray-600">{source.platform}</td>

                  <td className="px-4 py-3 text-center">
                    {source.urlScore !== null ? (
                      <div>
                        <p className={`font-semibold ${scoreColor}`}>{source.urlScore}/100</p>
                        {isLowQuality && <p className="text-xs text-error-500">⚠️ Baja calidad</p>}
                      </div>
                    ) : (
                      <p className="text-[var(--hp-text-muted)] text-xs">Sin datos</p>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-gray-600">{source.totalUrls}</td>

                  <td className="px-4 py-3 text-center">
                    {source.paused ? (
                      <div className="inline-block bg-warning-100 text-warning-700 px-2 py-1 rounded text-xs font-medium">
                        ⏸️ Pausada
                        {source.pausedAt && (
                          <p className="text-xs text-warning-600">
                            {new Date(source.pausedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="inline-block bg-success-100 text-success-700 px-2 py-1 rounded text-xs font-medium">
                        ✅ Activa
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/sources/${source.id}`}
                      className="text-brand-600 hover:text-brand-700 font-medium"
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
        <div className="text-center py-8 text-[var(--hp-text-muted)]">No hay fuentes disponibles</div>
      )}
    </div>
  );
}
