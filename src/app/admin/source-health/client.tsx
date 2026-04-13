'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function SourceHealthClient() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/source-health')
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="animate-pulse bg-gray-100 h-96 rounded-xl w-full"></div>;
  }

  // Preparando datos para gráfica: distribución de Scores (agrupados por tiempo de actualización es complejo por pocos datos)
  // Como simplificación visual, mostramos la distribución del score de cada fuente actual.
  const chartData = data.map((d) => ({
    name: d.source.substring(0, 15) + (d.source.length > 15 ? '...' : ''),
    score: (d.score * 10).toFixed(2), // normalizado 1-10
    latency: d.avgResponseMs,
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const criticalSources = data.filter(s => s.status === 'critical').length;

  return (
    <div className="space-y-6">
      
      {/* Alertas Proactivas */}
      {criticalSources > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Cuidado: {criticalSources} orígenes tienen estado CRITICAL</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>Las extracciones a este dominio están suspendidas algorítmicamente y en ventana de enfriamiento (6 horas).</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gráfica de Score Normalizado */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Panorama de Scores de Origen</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 10]} orientation='left' tick={{ fontSize: 12 }} />
              <RechartsTooltip />
              <ReferenceLine y={4} stroke="red" strokeDasharray="3 3" label={{ position: 'top', value: 'Critical Threshold', fill: 'red', fontSize: 12 }} />
              <ReferenceLine y={7} stroke="#eab308" strokeDasharray="3 3" label={{ position: 'top', value: 'Degraded Threshold', fill: '#eab308', fontSize: 12 }} />
              <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla detallada */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Success Rate</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Latency</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Success</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row) => {
              const total = row.successCount + row.errorCount;
              const sRate = total > 0 ? Math.round((row.successCount / total) * 100) : 0;
              return (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.source}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(row.status)}`}>
                      {row.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{(row.score * 10).toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <span className="mr-2">{sRate}%</span>
                      <div className="relative w-full overflow-hidden bg-gray-200 rounded-full h-2">
                         <div style={{width: `${sRate}%`}} className={`h-2 rounded-full ${sRate > 70 ? 'bg-green-500' : sRate > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.avgResponseMs}ms</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {row.lastSuccessAt ? new Date(row.lastSuccessAt).toLocaleString() : 'N/A'}
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                  Sin registros de orígenes procesados todavía. Inicia una extracción.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
