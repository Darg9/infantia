'use client';
// =============================================================================
// ActivityDetailMapInner — implementación Leaflet real del mini-mapa
// Cargado sólo en cliente (ssr: false desde ActivityDetailMap)
// =============================================================================

import { useEffect, useRef } from 'react';

interface Props {
  lat:          number;
  lng:          number;
  locationName: string;
  address?:     string | null;
}

export default function ActivityDetailMapInner({ lat, lng, locationName, address }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // CSS de Leaflet dinámico (evita conflicto webpack/SSR)
    if (!document.getElementById('leaflet-css')) {
      const link  = document.createElement('link');
      link.id   = 'leaflet-css';
      link.rel  = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    import('leaflet').then((L) => {
      if (mapRef.current) return; // guard doble-montaje

      const map = L.map(containerRef.current!, {
        center:           [lat, lng],
        zoom:             15,
        zoomControl:      true,
        scrollWheelZoom:  false,   // no secuestra el scroll de la página
        attributionControl: false, // minimiza UI para el mini-mapa
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Pin índigo igual al del mapa de lista
      const icon = L.divIcon({
        html: `<div style="
          width:26px;height:26px;
          background:#4f46e5;
          border:3px solid #fff;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 2px 8px rgba(0,0,0,.35);
        "></div>`,
        className:   '',
        iconSize:    [26, 26],
        iconAnchor:  [13, 26],
        popupAnchor: [0, -28],
      });

      const popup = `
        <div style="font-family:system-ui,sans-serif;font-size:13px;min-width:160px">
          <p style="font-weight:700;margin:0 0 3px;color:#111">${escHtml(locationName)}</p>
          ${address ? `<p style="margin:0;color:#555;font-size:12px">${escHtml(address)}</p>` : ''}
        </div>
      `;

      L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(popup, { maxWidth: 220 })
        .openPopup();

      mapRef.current = map;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // sólo al montar — lat/lng no cambian en detalle

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden border border-[var(--hp-border)]"
      style={{ height: '180px' }}
    />
  );
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
