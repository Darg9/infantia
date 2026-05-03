'use client';
// =============================================================================
// ActivityDetailMap — mini-mapa en la página de detalle de una actividad
// Importado sin SSR (Leaflet requiere window)
// =============================================================================

import dynamic from 'next/dynamic';

const MapWidget = dynamic(() => import('./ActivityDetailMapInner'), {
  ssr: false,
  loading: () => (
    <div
      className='w-full rounded-xl bg-[var(--hp-bg-page)] animate-pulse border border-[var(--hp-border)]'
      style={{ height: '180px' }}
    />
  ),
});

interface Props {
  lat:          number;
  lng:          number;
  locationName: string;
  address?:     string | null;
}

export function ActivityDetailMap(props: Props) {
  return <MapWidget {...props} />;
}
