'use client';
// =============================================================================
// MapView — wrapper del mapa de actividades
// Importa MapInner dinámicamente (sin SSR) y construye los searchParams
// =============================================================================

import dynamic from 'next/dynamic';
import { useMemo } from 'react';

// Sin SSR: Leaflet requiere window
const MapInner = dynamic(() => import('./MapInner'), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center rounded-2xl bg-gray-100 animate-pulse border border-gray-200"
      style={{ height: '520px' }}
    >
      <p className="text-sm text-gray-400">Cargando mapa...</p>
    </div>
  ),
});

interface MapViewProps {
  search:     string;
  ageMin:     string;
  ageMax:     string;
  categoryId: string;
  cityId:     string;
  type:       string;
  audience:   string;
  price:      string;
}

export function MapView(props: MapViewProps) {
  const searchParams = useMemo(() => {
    const sp = new URLSearchParams();
    (Object.entries(props) as [string, string][]).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    return sp.toString();
  }, [props]);

  return <MapInner searchParams={searchParams} height="520px" />;
}
