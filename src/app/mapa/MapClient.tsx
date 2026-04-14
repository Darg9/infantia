'use client'

import dynamic from 'next/dynamic'
import type { MapPoint } from '@/components/ActivityMap'

const ActivityMap = dynamic(() => import('@/components/ActivityMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-2xl">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Cargando mapa…</p>
      </div>
    </div>
  ),
})

export default function MapClient({ points }: { points: MapPoint[] }) {
  return <ActivityMap points={points} />
}
