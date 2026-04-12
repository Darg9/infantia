'use client'

import { useEffect, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts"
import Link from 'next/link'

interface MetricData {
  createdAt: string;
  avgLength: number;
  pctShort: number;
  pctNoise: number;
  pctPromo: number;
}

export default function QualityDashboardClient() {
  const [data, setData] = useState<MetricData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/quality")
      .then(res => res.json())
      .then((rawData) => {
        // Formateo de fecha para el eje X
        const formattedData = rawData.map((d: any) => ({
          ...d,
          createdAt: new Date(d.createdAt).toLocaleDateString("es-CO", {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        }))
        setData(formattedData)
        setLoading(false)
      })
      .catch(err => {
        console.error("Error loading metrics:", err);
        setLoading(false)
      })
  }, [])

  // Alerta de degradación sobre el último registro
  const latest = data.length > 0 ? data[data.length - 1] : null;
  const isDegrading = latest ? (latest.pctShort > 20 || latest.pctNoise > 15 || latest.pctPromo > 10) : false;

  return (
    <div className="max-w-5xl mx-auto py-12 px-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Quality</h1>
          <p className="text-gray-500 mt-1">Evolución e impacto del pipeline de reescritura</p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 px-4 py-2 border border-indigo-100 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition">
          ← Volver a Admin
        </Link>
      </div>

      {isDegrading && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 rounded-md shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0 text-xl">⚠️</div>
            <div className="ml-3">
              <h3 className="text-sm font-bold text-red-800">Calidad del contenido degradándose</h3>
              <div className="mt-1 text-sm text-red-700">
                <p>Múltiples señales se sobrepasaron en el último registro. Considera habilitar ambiguityScore.</p>
              </div>
            </div>
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
        <div className="bg-gray-50 text-center py-16 rounded-2xl border border-gray-200 shadow-sm text-gray-500">
           No hay métricas recopiladas todavía. Corre el script de backfill primero.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Avg Length */}
          <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Avg Description Length</h2>
              <p className="text-sm text-gray-500 text-pretty">Longitud promedio del output del pipeline.</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="createdAt" tick={{fontSize: 12, fill: '#6B7280'}} tickMargin={10} minTickGap={30} />
                  <YAxis tick={{fontSize: 12, fill: '#6B7280'}} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="avgLength" stroke="#4F46E5" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} name="Promedio (chars)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* % Short */}
            <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900">% Short Descriptions ({'<'}60)</h2>
                <p className="text-xs text-gray-500 font-mono mt-1">Umbral alerta: {'>'} 20% (Actual: {latest?.pctShort.toFixed(1)}%)</p>
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="createdAt" tick={{fontSize: 12, fill: '#6B7280'}} minTickGap={30} />
                    <YAxis tick={{fontSize: 12, fill: '#6B7280'}} />
                    <Tooltip contentStyle={{ borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="pctShort" stroke="#F59E0B" strokeWidth={2} name="% Cortas" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* % Noise */}
            <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900">% Noise in Sources</h2>
                <p className="text-xs text-gray-500 font-mono mt-1">Umbral alerta: {'>'} 15% (Actual: {latest?.pctNoise.toFixed(1)}%)</p>
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="createdAt" tick={{fontSize: 12, fill: '#6B7280'}} minTickGap={30} />
                    <YAxis tick={{fontSize: 12, fill: '#6B7280'}} />
                    <Tooltip contentStyle={{ borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="pctNoise" stroke="#EF4444" strokeWidth={2} name="% Ruido (Fuente)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
            
            {/* % Promo */}
            <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm md:col-span-2">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Promo Canary</h2>
                <p className="text-xs text-gray-500 font-mono mt-1">Umbral alerta: {'>'} 10% (Si sube, normalize está fallando)</p>
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="createdAt" tick={{fontSize: 12, fill: '#6B7280'}} minTickGap={30} />
                    <YAxis tick={{fontSize: 12, fill: '#6B7280'}} />
                    <Tooltip contentStyle={{ borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="pctPromo" stroke="#10B981" strokeWidth={2} name="% Promocional" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
