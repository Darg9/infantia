"use client";

import { useEffect, useState } from "react";

interface AnalyticsData {
  type: string;
  _count: number;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
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
  const searches = getCount("search_applied");

  // Calcs
  const ctrRatio = pageViews > 0 ? ((activityClicks / pageViews) * 100).toFixed(1) : "0.0";
  const convRatio = activityViews > 0 ? ((outboundClicks / activityViews) * 100).toFixed(1) : "0.0";

  if (loading) {
    return <div className="p-10 text-center text-[var(--hp-text-secondary)]">Cargando métricas en tiempo real...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--hp-text-primary)]">
          Analytics <span className="text-sm font-medium text-[var(--hp-text-muted)] align-middle ml-2">(Últimas 24h)</span>
        </h1>
        <p className="text-[var(--hp-text-secondary)] mt-1">Panel de monitoreo interno sin dependencias externas.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CTR Card */}
        <div className="bg-[var(--hp-bg-surface)] rounded-xl border border-[var(--hp-border)] p-6 shadow-sm">
          <div className="text-sm font-semibold text-[var(--hp-text-secondary)] mb-1 tracking-wide uppercase">CTR (Exploración)</div>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-extrabold text-brand-500">{ctrRatio}%</span>
            <span className="text-sm text-[var(--hp-text-muted)] mb-1">
              ({activityClicks} clicks / {pageViews} vistas)
            </span>
          </div>
          <p className="text-xs text-[var(--hp-text-muted)] mt-3">Porcentaje de usuarios que abren alguna actividad.</p>
        </div>

        {/* Conversion Card */}
        <div className="bg-[var(--hp-bg-surface)] rounded-xl border border-[var(--hp-border)] p-6 shadow-sm">
          <div className="text-sm font-semibold text-success-600 mb-1 tracking-wide uppercase">Conversión a Fuente</div>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-extrabold text-success-500">{convRatio}%</span>
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
        <div className="divide-y divide-gray-100">
          {data.length === 0 ? (
            <div className="px-6 py-6 text-[var(--hp-text-muted)] text-center">No hay registros recientes en la ventana de 24h.</div>
          ) : (
            data.sort((a,b) => b._count - a._count).map((item) => (
              <div key={item.type} className="flex justify-between px-6 py-4 hover:bg-[var(--hp-bg-page)] transition-colors">
                <span className="font-medium text-[var(--hp-text-primary)]">{item.type}</span>
                <span className="text-[var(--hp-text-secondary)] font-mono bg-gray-100 px-3 py-1 rounded-full text-xs">
                  {item._count.toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
