'use client';
import { Button, Input } from '@/components/ui';

import { useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ByReason {
  process: number;
  datetime_past: number;
  text_date_past: number;
  past_year_only: number;
  keyword_past: number;
}

interface Stats {
  total: number;
  skipped: number;
  processed: number;
  skipRate: number;
  processRate: number;
  fallbackCount: number;
  fallbackRate: number;
  byReason: ByReason;
}

interface PreflightRow {
  id: string;
  source_id: string | null;
  url: string;
  raw_date_text: string | null;
  parsed_date: string | null;
  reason: string;
  used_fallback: boolean;
  skip: boolean;
  created_at: string;
}

interface SourceStat {
  sourceId: string | null;
  total: number;
  skipped: number;
  skipRate: number;
}

interface ApiResponse {
  stats: Stats;
  bySource: SourceStat[];
  rows: PreflightRow[];
  limit: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function nDaysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case 'process':        return 'Procesada';
    case 'datetime_past':  return 'Pasada (datetime)';
    case 'text_date_past': return 'Pasada (texto)';
    case 'past_year_only': return 'Pasada (año)';
    case 'keyword_past':   return 'Pasada (keyword)';
    default:               return reason;
  }
}

function reasonBadgeClass(reason: string): string {
  switch (reason) {
    case 'process':        return 'bg-success-100 text-success-700';
    case 'datetime_past':  return 'bg-warning-100 text-warning-700';
    case 'text_date_past': return 'bg-warning-100 text-warning-600';
    case 'past_year_only': return 'bg-orange-100 text-orange-700';
    case 'keyword_past':   return 'bg-orange-100 text-orange-600';
    default:               return 'bg-gray-100 text-gray-600';
  }
}

function skipBadgeClass(skip: boolean): string {
  return skip
    ? 'bg-error-100 text-error-700'
    : 'bg-success-100 text-success-700';
}

/** Ancho relativo de la barra de breakdown (0–100%) */
function barWidth(count: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}

const REASON_ORDER: (keyof ByReason)[] = [
  'process',
  'datetime_past',
  'text_date_past',
  'past_year_only',
  'keyword_past',
];

const REASON_BAR_COLOR: Record<string, string> = {
  process:        'bg-success-400',
  datetime_past:  'bg-warning-400',
  text_date_past: 'bg-warning-300',
  past_year_only: 'bg-orange-400',
  keyword_past:   'bg-orange-300',
};

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PreflightClient() {
  const [from, setFrom] = useState(nDaysAgoStr(7));
  const [to,   setTo]   = useState(todayStr());
  const [limit, setLimit] = useState(100);

  const [data, setData]     = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from,
        to,
        limit: String(limit),
      });
      const res = await fetch(`/api/admin/preflight?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ApiResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [from, to, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-4 bg-[var(--hp-bg-page)] border border-[var(--hp-border)] rounded-2xl px-5 py-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Desde</label>
          {/* eslint-disable-next-line no-restricted-syntax -- formulario interno, DS Input requiere id+label */}
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Hasta</label>
          {/* eslint-disable-next-line no-restricted-syntax -- formulario interno, DS Input requiere id+label */}
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Límite filas</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {[50, 100, 200, 500].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <Button
          onClick={() => { setFrom(nDaysAgoStr(7)); setTo(todayStr()); }}
          className="text-xs text-brand-600 hover:underline self-end pb-1.5"
        >
          Últimos 7 días
        </Button>
      </div>
      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-error-50 border border-error-200 rounded-2xl p-4 text-error-700 text-sm">
          {error}{' '}
          <Button onClick={fetchData} className="underline hover:no-underline ml-1">
            Reintentar
          </Button>
        </div>
      )}
      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-[var(--hp-text-primary)] mb-3">Resumen</h2>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: 'Total URLs',
                value: data.stats.total.toLocaleString('es-CO'),
                sub: 'en el rango seleccionado',
                color: 'text-[var(--hp-text-primary)]',
                bg: 'bg-[var(--hp-bg-surface)]',
              },
              {
                label: 'Procesadas',
                value: `${data.stats.processRate}%`,
                sub: `${data.stats.processed.toLocaleString('es-CO')} enviadas a Gemini`,
                color: 'text-success-700',
                bg: 'bg-success-50',
              },
              {
                label: 'Tasa de omisión',
                value: `${data.stats.skipRate}%`,
                sub: `${data.stats.skipped.toLocaleString('es-CO')} descartadas por preflight`,
                color:
                  data.stats.skipRate > 70
                    ? 'text-error-700'
                    : data.stats.skipRate < 5
                      ? 'text-warning-700'
                      : 'text-[var(--hp-text-primary)]',
                bg:
                  data.stats.skipRate > 70
                    ? 'bg-error-50'
                    : data.stats.skipRate < 5
                      ? 'bg-warning-50'
                      : 'bg-[var(--hp-bg-surface)]',
              },
              {
                // "Fallback" aquí = capa 2/3 del preflight de fechas (texto/año/keyword),
                // NO el parser fallback (Gemini → Cheerio). Etiqueta explícita para evitar confusión.
                label: 'Detección capa 2/3',
                value: `${data.stats.fallbackRate}%`,
                sub: `Texto/año/keyword en ${data.stats.fallbackCount.toLocaleString('es-CO')} URLs (menos preciso)`,
                color: data.stats.fallbackRate > 50 ? 'text-warning-700' : 'text-gray-600',
                bg: data.stats.fallbackRate > 50 ? 'bg-warning-50' : 'bg-[var(--hp-bg-surface)]',
              },
            ].map(({ label, value, sub, color, bg }) => (
              <div
                key={label}
                className={`border border-[var(--hp-border)] rounded-2xl p-4 ${bg}`}
              >
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs font-medium text-[var(--hp-text-primary)] mt-0.5">{label}</p>
                <p className="text-xs text-[var(--hp-text-muted)] mt-1">{sub}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
      {/* ── Alertas de over/under filtering ────────────────────────────── */}
      {!loading && data && data.stats.total > 0 && (
        <div>
          {data.stats.skipRate > 70 && (
            <div className="bg-error-50 border border-error-200 rounded-xl px-4 py-3 text-sm text-error-700">
              🚨 <strong>Over-filtering:</strong> el {data.stats.skipRate}% de URLs están siendo descartadas.
              Verifica que los patrones de detección no sean demasiado agresivos.
            </div>
          )}
          {data.stats.skipRate < 5 && data.stats.total >= 20 && (
            <div className="bg-warning-50 border border-warning-200 rounded-xl px-4 py-3 text-sm text-warning-700">
              ⚠️ <strong>Under-filtering:</strong> solo el {data.stats.skipRate}% de URLs se omiten.
              Es posible que muchos eventos pasados estén llegando a Gemini.
            </div>
          )}
          {data.stats.fallbackRate > 50 && (
            <div className="bg-warning-50 border border-warning-200 rounded-xl px-4 py-3 text-sm text-warning-700 mt-2">
              ⚠️ <strong>Detección capa 2/3 elevada ({data.stats.fallbackRate}%):</strong> la mayoría de omisiones
              usan texto/año/keyword (menos preciso que atributo <code>datetime</code>). Revisa las fuentes con mayor skip_rate abajo.
            </div>
          )}
        </div>
      )}
      {/* ── Breakdown por reason ────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-[var(--hp-text-primary)] mb-3">Breakdown por razón</h2>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)}
          </div>
        ) : data && data.stats.total > 0 ? (
          <div className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--hp-bg-page)] text-xs text-[var(--hp-text-secondary)] border-b border-[var(--hp-border)]">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Razón</th>
                  <th className="px-4 py-2 text-right font-medium w-16">N</th>
                  <th className="px-4 py-2 text-right font-medium w-12">%</th>
                  <th className="px-4 py-2 w-40"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {REASON_ORDER.map((key) => {
                  const count = data.stats.byReason[key];
                  const pct = data.stats.total > 0
                    ? Math.round((count / data.stats.total) * 100)
                    : 0;
                  return (
                    <tr key={key} className="hover:bg-[var(--hp-bg-page)]">
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${reasonBadgeClass(key)}`}>
                          {reasonLabel(key)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-[var(--hp-text-primary)]">
                        {count.toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[var(--hp-text-secondary)] text-xs">
                        {pct}%
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${REASON_BAR_COLOR[key] ?? 'bg-gray-300'}`}
                            style={{ width: barWidth(count, data.stats.total) }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : !loading ? (
          <p className="text-[var(--hp-text-muted)] text-sm">No hay datos en este rango.</p>
        ) : null}
      </section>
      {/* ── Breakdown por fuente ────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-[var(--hp-text-primary)] mb-3">Por fuente (top 15)</h2>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8" />)}
          </div>
        ) : !data || data.bySource.length === 0 ? (
          <p className="text-[var(--hp-text-muted)] text-sm">No hay datos en este rango.</p>
        ) : (
          <div className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--hp-bg-page)] text-xs text-[var(--hp-text-secondary)] border-b border-[var(--hp-border)]">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Fuente</th>
                  <th className="px-4 py-2 text-right font-medium w-16">Total</th>
                  <th className="px-4 py-2 text-right font-medium w-20">Omitidas</th>
                  <th className="px-4 py-2 text-right font-medium w-20">Skip %</th>
                  <th className="px-4 py-2 w-32"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.bySource.map((src) => {
                  const isHigh = src.skipRate > 70;
                  const isLow  = src.skipRate < 5 && src.total >= 10;
                  return (
                    <tr key={src.sourceId ?? '__none__'} className="hover:bg-[var(--hp-bg-page)]">
                      <td className="px-4 py-2 font-mono text-xs text-[var(--hp-text-primary)]">
                        {src.sourceId ?? <span className="italic text-[var(--hp-text-muted)]">(sin fuente)</span>}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {src.total.toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {src.skipped.toLocaleString('es-CO')}
                      </td>
                      <td className={`px-4 py-2 text-right font-semibold text-xs ${
                        isHigh ? 'text-error-600' : isLow ? 'text-warning-600' : 'text-gray-600'
                      }`}>
                        {src.skipRate}%
                        {isHigh && <span className="ml-1">🔴</span>}
                        {isLow  && <span className="ml-1">⚠️</span>}
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isHigh ? 'bg-error-400' : isLow ? 'bg-warning-400' : 'bg-brand-400'
                            }`}
                            style={{ width: barWidth(src.skipped, src.total) }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {/* ── Tabla de filas ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-[var(--hp-text-primary)] mb-3">
          Registros
          {data && <span className="text-[var(--hp-text-muted)] font-normal text-sm ml-2">(últimas {data.limit})</span>}
        </h2>

        {loading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="text-center py-12 bg-[var(--hp-bg-page)] border border-[var(--hp-border)] rounded-2xl">
            <p className="text-[var(--hp-text-muted)] text-sm">No hay datos en este rango.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)]">
            <table className="w-full text-xs">
              <thead className="bg-[var(--hp-bg-page)] border-b border-[var(--hp-border)] text-[var(--hp-text-secondary)]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">URL</th>
                  <th className="px-4 py-3 text-left font-medium">Texto fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Fecha parseada</th>
                  <th className="px-4 py-3 text-center font-medium">Skip</th>
                  <th className="px-4 py-3 text-left font-medium">Razón</th>
                  <th className="px-4 py-3 text-left font-medium">Fuente</th>
                  <th className="px-4 py-3 text-left font-medium">Fecha log</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-[var(--hp-bg-page)]">
                    {/* URL */}
                    <td className="px-4 py-2.5 max-w-[200px]">
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:underline truncate block"
                        title={row.url}
                      >
                        {row.url.replace(/^https?:\/\//, '').slice(0, 50)}
                        {row.url.replace(/^https?:\/\//, '').length > 50 ? '…' : ''}
                      </a>
                    </td>

                    {/* Raw date text */}
                    <td className="px-4 py-2.5 max-w-[160px]">
                      {row.raw_date_text ? (
                        <span
                          className="font-mono text-[var(--hp-text-primary)] truncate block"
                          title={row.raw_date_text}
                        >
                          {row.raw_date_text.slice(0, 30)}
                          {row.raw_date_text.length > 30 ? '…' : ''}
                        </span>
                      ) : (
                        <span className="text-[var(--hp-text-muted)]">—</span>
                      )}
                    </td>

                    {/* Parsed date */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {row.parsed_date ? (
                        <span className="font-mono text-[var(--hp-text-primary)]">{row.parsed_date}</span>
                      ) : (
                        <span className="text-[var(--hp-text-muted)]">—</span>
                      )}
                    </td>

                    {/* Skip badge */}
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${skipBadgeClass(row.skip)}`}>
                        {row.skip ? 'Omitida' : 'OK'}
                      </span>
                    </td>

                    {/* Reason */}
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${reasonBadgeClass(row.reason)}`}>
                        {reasonLabel(row.reason)}
                      </span>
                    </td>

                    {/* Source */}
                    <td className="px-4 py-2.5 max-w-[100px]">
                      {row.source_id ? (
                        <span className="text-[var(--hp-text-secondary)] truncate block" title={row.source_id}>
                          {row.source_id.slice(0, 20)}
                          {row.source_id.length > 20 ? '…' : ''}
                        </span>
                      ) : (
                        <span className="text-[var(--hp-text-muted)]">—</span>
                      )}
                    </td>

                    {/* created_at */}
                    <td className="px-4 py-2.5 whitespace-nowrap text-[var(--hp-text-muted)]">
                      {new Date(row.created_at).toLocaleString('es-CO', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
