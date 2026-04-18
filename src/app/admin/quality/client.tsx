'use client'

import { createLogger } from '@/lib/logger'
import { useEffect, useState } from "react"

const log = createLogger('admin:quality')
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Legend
} from "recharts"
import Link from 'next/link'
import { getSystemStatus } from "@/modules/scraping/alerts";

interface MetricData {
  createdAt: string;
  avgLength: number;
  pctShort: number;
  pctNoise: number;
  pctPromo: number;
  discardRate: number;
}

export default function QualityDashboardClient() {
  const [data, setData] = useState<MetricData[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ from: "", to: "", source: "" })

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.from) params.append("from", filters.from)
      if (filters.to) params.append("to", filters.to)
      if (filters.source) params.append("source", filters.source)

      const res = await fetch(`/api/admin/quality?${params.toString()}`)
      const rawData = await res.json()
      
      const formattedData = rawData.map((d: MetricData) => ({
        ...d,
        createdAt: new Date(d.createdAt).toLocaleDateString("es-CO", {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }))
      setData(formattedData)
    } catch (err) {
      log.error('Error loading metrics', { error: err });
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [filters])

  const latest = data.length > 0 ? data[data.length - 1] : null;
  const status = getSystemStatus(latest);

  const percentFormatter = (val: number) => `${(val * 100).toFixed(1)}%`;
  const basePercentFormatter = (val: number) => `${val.toFixed(1)}%`;

  return (
    <div className="max-w-5xl mx-auto py-12 px-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--hp-text-primary)]">Content Quality Dashboard</h1>
          <p className="text-[var(--hp-text-secondary)] mt-1">Observabilidad del pipeline de contenido</p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-brand-600 hover:text-brand-500 px-4 py-2 border border-brand-100 rounded-lg bg-brand-50 hover:bg-brand-100 transition">
          ← Volver a Admin
        </Link>
      </div>

      <div className="bg-[var(--hp-bg-surface)] p-4 rounded-xl border border-[var(--hp-border)] shadow-sm mb-8 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-[var(--hp-text-secondary)] mb-1">Desde</label>
          <input 
            type="date" 
            className="border border-[var(--hp-border)] rounded px-3 py-1.5 text-sm"
            value={filters.from}
            onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--hp-text-secondary)] mb-1">Hasta</label>
          <input 
            type="date" 
            className="border border-[var(--hp-border)] rounded px-3 py-1.5 text-sm"
            value={filters.to}
            onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--hp-text-secondary)] mb-1">Fuente / Etapa</label>
          <select 
            className="border border-[var(--hp-border)] rounded px-3 py-1.5 text-sm"
            value={filters.source}
            onChange={(e) => setFilters(f => ({ ...f, source: e.target.value }))}
          >
            <option value="">Todas las fuentes</option>
            <option value="backfill">Backfill</option>
            <option value="ingestion">Ingestión diaria</option>
          </select>
        </div>
        <button 
          onClick={() => setFilters({ from: "", to: "", source: "" })}
          className="text-sm text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)] px-2 py-1.5"
        >
          Reset
        </button>
      </div>

      {status === 'over' && (
        <div className="bg-error-50 border-l-4 border-error-500 p-4 mb-8 rounded-md shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0 text-xl">🚨</div>
            <div className="ml-3">
              <h3 className="text-sm font-bold text-error-800">Over-filtering detectado</h3>
              <p className="mt-1 text-sm text-error-700">El sistema evaluativo es demasiado severo. Rebaja los thresholds.</p>
            </div>
          </div>
        </div>
      )}

      {status === 'under' && (
        <div className="bg-warning-50 border-l-4 border-warning-500 p-4 mb-8 rounded-md shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0 text-xl">⚠️</div>
            <div className="ml-3">
              <h3 className="text-sm font-bold text-warning-800">Under-filtering detectado</h3>
              <p className="mt-1 text-sm text-warning-700">El sistema está permitiendo que contenido muy pobre penetre. Endurece las reglas.</p>
            </div>
          </div>
        </div>
      )}

      {status === 'healthy' && (
        <div className="bg-success-50 border-l-4 border-success-500 p-4 mb-8 rounded-md shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0 text-xl">✅</div>
            <div className="ml-3">
              <h3 className="text-sm font-bold text-success-800">Sistema saludable</h3>
              <p className="mt-1 text-sm text-success-700">La curaduría opera dentro de márgenes totalmente seguros.</p>
            </div>
          </div>
        </div>
      )}

      {latest && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-[var(--hp-bg-surface)] p-6 rounded-2xl border border-[var(--hp-border)] shadow-sm flex flex-col justify-center">
            <h3 className="text-sm font-medium text-[var(--hp-text-secondary)]">Discard Rate (Actual)</h3>
            <p className="text-3xl font-bold text-brand-500 mt-2">{percentFormatter(latest.discardRate)}</p>
          </div>
          <div className="bg-[var(--hp-bg-surface)] p-6 rounded-2xl border border-[var(--hp-border)] shadow-sm flex flex-col justify-center">
            <h3 className="text-sm font-medium text-[var(--hp-text-secondary)]">Avg Length (Actual)</h3>
            <p className="text-3xl font-bold text-brand-500 mt-2">{latest.avgLength}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-6 py-1">
            <div className="h-40 bg-gray-200 rounded-xl"></div>
            <div className="h-40 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-[var(--hp-bg-page)] text-center py-16 rounded-2xl border border-[var(--hp-border)] shadow-sm text-[var(--hp-text-secondary)]">
           No hay métricas recopiladas todavía. Corre el script de backfill primero.
        </div>
      ) : (
        <div className="space-y-8">
          
          <section className="bg-[var(--hp-bg-surface)] p-6 rounded-2xl border border-[var(--hp-border)] shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[var(--hp-text-primary)]">Discard Rate Timeline</h2>
              <p className="text-sm text-[var(--hp-text-secondary)] text-pretty">Presión del filtro y volumen denegado a BD.</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="createdAt" tick={{fontSize: 12, fill: '#6B7280'}} tickMargin={10} minTickGap={30} />
                  <YAxis tickFormatter={percentFormatter} tick={{fontSize: 12, fill: '#6B7280'}} />
                  <Tooltip formatter={(value) => percentFormatter(Number(value))} contentStyle={{ borderRadius: '8px' }} />
                  <ReferenceLine y={0.10} stroke="#EAB308" strokeDasharray="3 3" />
                  <ReferenceLine y={0.35} stroke="#22C55E" strokeDasharray="3 3" />
                  <ReferenceLine y={0.50} stroke="#EF4444" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="discardRate" stroke="#3B82F6" strokeWidth={3} dot={false} activeDot={{r: 6}} name="Discard Rate" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-[var(--hp-bg-surface)] p-6 rounded-2xl border border-[var(--hp-border)] shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[var(--hp-text-primary)]">Average Min-Length Timeline</h2>
              <p className="text-sm text-[var(--hp-text-secondary)] text-pretty">Longitud de string dinámicamente aprobada.</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="createdAt" tick={{fontSize: 12, fill: '#6B7280'}} tickMargin={10} minTickGap={30} />
                  <YAxis tick={{fontSize: 12, fill: '#6B7280'}} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                  <ReferenceLine y={40} stroke="#EAB308" strokeDasharray="3 3" />
                  <ReferenceLine y={65} stroke="#22C55E" strokeDasharray="3 3" />
                  <ReferenceLine y={75} stroke="#EF4444" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="avgLength" stroke="#4F46E5" strokeWidth={3} dot={false} activeDot={{r: 6}} name="Avg Length (chars)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-[var(--hp-bg-surface)] p-6 rounded-2xl border border-[var(--hp-border)] shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[var(--hp-text-primary)]">Quality Metrics Raw</h2>
              <p className="text-sm text-[var(--hp-text-secondary)] text-pretty">Señales históricas consolidadas.</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="createdAt" tick={{fontSize: 12, fill: '#6B7280'}} tickMargin={10} minTickGap={30} />
                  <YAxis tickFormatter={basePercentFormatter} tick={{fontSize: 12, fill: '#6B7280'}} />
                  <Tooltip formatter={(value) => basePercentFormatter(Number(value))} contentStyle={{ borderRadius: '8px', zIndex: 1000 }} />
                  <Legend verticalAlign="top" height={36}/>
                  <Line type="monotone" dataKey="pctShort" stroke="#F59E0B" strokeWidth={2} dot={false} activeDot={{r: 5}} name="% Cortas" />
                  <Line type="monotone" dataKey="pctNoise" stroke="#EF4444" strokeWidth={2} dot={false} activeDot={{r: 5}} name="% Ruido" />
                  <Line type="monotone" dataKey="pctPromo" stroke="#10B981" strokeWidth={2} dot={false} activeDot={{r: 5}} name="% Promo" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

        </div>
      )}
    </div>
  )
}
