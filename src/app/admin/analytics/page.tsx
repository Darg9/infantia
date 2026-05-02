"use client";

import { useEffect, useState } from "react";

interface AnalyticsData {
  type: string;
  _count: number;
}

interface CityMatrixData {
  cityId: string;
  cityName: string;
  activeSupply: number;
  visits: number;
  modalOpens: number;
  selections: number;
  escapes: number;
}

interface FilterData {
  type: string;
  value: string;
  count: number;
  zeroResults: number;
  withQuery: number;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [matrix, setMatrix] = useState<CityMatrixData[]>([]);
  const [filters, setFilters] = useState<FilterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'all' | 'no-bogota'>('all');

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((res) => res.json())
      .then((json) => {
        if (json.globalEvents) {
          setData(json.globalEvents);
        } else if (Array.isArray(json)) {
          // Fallback if backend wasn't updated yet or cached
          setData(json);
        }
        if (json.matrix) {
          setMatrix(json.matrix);
        }
        if (json.filters) {
          setFilters(json.filters);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Helpers to pick specific counts securely
  const getCount = (eventType: string) => {
    const item = data.find((d) => d.type === eventType);
    return item ? item._count : 0;
  };

  const pageViews = getCount("page_view");
  const activityClicks = getCount("activity_click");
  const activityViews = getCount("activity_view");
  const outboundClicks = getCount("outbound_click");

  // Calcs
  const ctrRatio = pageViews > 0 ? ((activityClicks / pageViews) * 100).toFixed(1) : "0.0";
  const convRatio = activityViews > 0 ? ((outboundClicks / activityViews) * 100).toFixed(1) : "0.0";

  if (loading) {
    return <div className="p-10 text-center text-[var(--hp-text-secondary)]">Cargando métricas en tiempo real...</div>;
  }

  // Filtrar y ordenar matriz
  const filteredMatrix = view === 'no-bogota' ? matrix.filter((c) => c.cityName !== 'Bogotá' && c.cityName !== 'Bogota') : matrix;
  const sortedMatrix = [...filteredMatrix].sort((a, b) => b.activeSupply - a.activeSupply);

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--hp-text-primary)]">
          Analytics <span className="text-sm font-medium text-[var(--hp-text-muted)] align-middle ml-2">(Últimas 72h)</span>
        </h1>
        <p className="text-[var(--hp-text-secondary)] mt-1">Monitoreo de Discovery, Inventario y Navegación Multi-Ciudad.</p>
      </div>

      {/* Radiografía de Supply y Navegación (Tabla Principal) */}
      <div className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--hp-border)] bg-[var(--hp-bg-page)] flex justify-between items-center">
          <h2 className="font-semibold text-[var(--hp-text-primary)]">Radiografía de Inventario (Vivo) y Discovery</h2>
          <div className="flex bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-lg p-1">
            <button
              onClick={() => setView('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'all' ? 'bg-[var(--hp-text-primary)] text-[var(--hp-bg-surface)]' : 'text-[var(--hp-text-secondary)] hover:bg-[var(--hp-bg-page)]'}`}
            >
              Todas (Vista A)
            </button>
            <button
              onClick={() => setView('no-bogota')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'no-bogota' ? 'bg-[var(--hp-text-primary)] text-[var(--hp-bg-surface)]' : 'text-[var(--hp-text-secondary)] hover:bg-[var(--hp-bg-page)]'}`}
            >
              Sin Bogotá (Vista B)
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--hp-bg-page)] text-[var(--hp-text-secondary)] border-b border-[var(--hp-border)]">
              <tr>
                <th className="px-6 py-3 font-medium">Ciudad</th>
                <th className="px-6 py-3 font-medium text-right">Activas Hoy (Supply)</th>
                <th className="px-6 py-3 font-medium text-right">Modal Opens (Intención)</th>
                <th className="px-6 py-3 font-medium text-right">Selections (Conversión)</th>
                <th className="px-6 py-3 font-medium text-right">Self-Retention</th>
                <th className="px-6 py-3 font-medium text-right">Escape Rate</th>
                <th className="px-6 py-3 font-medium text-right">Demand Pressure Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hp-border)]">
              {sortedMatrix.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[var(--hp-text-muted)]">Sin datos generados aún.</td>
                </tr>
              ) : (
                sortedMatrix.map((row) => {
                  // Calcular Ratios
                  const demandRatio = row.activeSupply > 0 ? (row.modalOpens / row.activeSupply).toFixed(2) : "0";
                  const escapePct = row.modalOpens > 0 ? ((row.escapes / row.modalOpens) * 100).toFixed(1) : "0.0";
                  const selfRetentionPct = row.modalOpens > 0 ? (((row.modalOpens - row.escapes) / row.modalOpens) * 100).toFixed(1) : "0.0";
                  
                  return (
                    <tr key={row.cityId} className="hover:bg-[var(--hp-bg-page)] transition-colors">
                      <td className="px-6 py-4 font-medium text-[var(--hp-text-primary)]">{row.cityName}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-mono text-[var(--hp-text-primary)] bg-[var(--hp-bg-surface)] px-2 py-1 rounded-md">
                          {row.activeSupply}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-[var(--hp-text-secondary)]">
                        {row.modalOpens}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-[var(--hp-text-primary)]">
                        {row.selections}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-[var(--hp-text-primary)]">
                        {row.modalOpens > 0 ? `${selfRetentionPct}%` : "-"}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-[var(--hp-text-secondary)]">
                        {row.escapes > 0 ? `${escapePct}% (${row.escapes})` : "-"}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-[var(--hp-text-secondary)]">
                        {demandRatio}x
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* KPI Cards (Globales) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CTR Card */}
        <div className="bg-[var(--hp-bg-surface)] rounded-xl border border-[var(--hp-border)] p-6 shadow-sm">
          <div className="text-sm font-semibold text-[var(--hp-text-secondary)] mb-1 tracking-wide uppercase">CTR Global (Exploración)</div>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-extrabold text-[var(--hp-text-primary)]">{ctrRatio}%</span>
            <span className="text-sm text-[var(--hp-text-muted)] mb-1">
              ({activityClicks} clicks / {pageViews} vistas)
            </span>
          </div>
          <p className="text-xs text-[var(--hp-text-muted)] mt-3">Porcentaje de usuarios que abren alguna actividad.</p>
        </div>

        {/* Conversion Card */}
        <div className="bg-[var(--hp-bg-surface)] rounded-xl border border-[var(--hp-border)] p-6 shadow-sm">
          <div className="text-sm font-semibold text-[var(--hp-text-primary)] mb-1 tracking-wide uppercase">Conversión a Fuente</div>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-extrabold text-[var(--hp-text-primary)]">{convRatio}%</span>
            <span className="text-sm text-[var(--hp-text-muted)] mb-1">
              ({outboundClicks} ops / {activityViews} aperturas)
            </span>
          </div>
          <p className="text-xs text-[var(--hp-text-muted)] mt-3">Tasa de interés resolutivo para ver fuente o comprar.</p>
        </div>
      </div>

      {/* Raw Event Volumes */}
      <div className="bg-[var(--hp-bg-surface)] border text-sm border-[var(--hp-border)] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--hp-border)] bg-[var(--hp-bg-page)]">
          <h2 className="font-semibold text-[var(--hp-text-primary)]">Tráfico Bruto por Evento</h2>
        </div>
        <div className="divide-y divide-[var(--hp-border)]">
          {data.length === 0 ? (
            <div className="px-6 py-6 text-[var(--hp-text-muted)] text-center">No hay registros recientes en la ventana.</div>
          ) : (
            data.sort((a,b) => b._count - a._count).map((item) => (
              <div key={item.type} className="flex justify-between px-6 py-4 hover:bg-[var(--hp-bg-page)] transition-colors">
                <span className="font-medium text-[var(--hp-text-primary)]">{item.type}</span>
                <span className="text-[var(--hp-text-secondary)] font-mono bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] px-3 py-1 rounded-full text-xs">
                  {item._count.toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Filter Analytics */}
      <div className="bg-[var(--hp-bg-surface)] border text-sm border-[var(--hp-border)] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--hp-border)] bg-[var(--hp-bg-page)]">
          <h2 className="font-semibold text-[var(--hp-text-primary)]">Intención y Refinamiento (Filtros)</h2>
          <p className="text-xs text-[var(--hp-text-muted)] mt-1">Uso de filtros facetados, tasa de fallos (0 resultados) y cruce con búsquedas de texto.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-[var(--hp-bg-page)] text-[var(--hp-text-secondary)] border-b border-[var(--hp-border)]">
              <tr>
                <th className="px-6 py-3 font-medium">Filtro</th>
                <th className="px-6 py-3 font-medium text-right">Uso Total</th>
                <th className="px-6 py-3 font-medium text-right">Con Búsqueda</th>
                <th className="px-6 py-3 font-medium text-right">0 Resultados (Ceguera)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hp-border)]">
              {filters.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[var(--hp-text-muted)]">Aún no hay interacción con filtros.</td>
                </tr>
              ) : (
                filters.sort((a,b) => b.count - a.count).map((item) => {
                  const zeroRate = item.count > 0 ? ((item.zeroResults / item.count) * 100).toFixed(1) : "0.0";
                  const queryRate = item.count > 0 ? ((item.withQuery / item.count) * 100).toFixed(1) : "0.0";
                  
                  return (
                    <tr key={`${item.type}:${item.value}`} className="hover:bg-[var(--hp-bg-page)] transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-[var(--hp-text-muted)] text-xs uppercase tracking-wide mr-2">{item.type}</span>
                        <span className="font-medium text-[var(--hp-text-primary)]">{item.value}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-[var(--hp-text-primary)]">
                        {item.count}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-[var(--hp-text-secondary)]">
                        {item.withQuery > 0 ? `${queryRate}% (${item.withQuery})` : "-"}
                      </td>
                      <td className="px-6 py-4 text-right font-mono">
                        <span className={item.zeroResults > 0 && Number(zeroRate) > 20 ? "text-error-600 font-bold" : "text-[var(--hp-text-secondary)]"}>
                          {item.zeroResults > 0 ? `${zeroRate}% (${item.zeroResults})` : "-"}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
