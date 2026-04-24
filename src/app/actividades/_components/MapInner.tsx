'use client';
// =============================================================================
// MapInner — componente Leaflet real (importado sin SSR desde MapView)
// Centro dinámico:
//   1. fitBounds sobre todos los pines (si existen)
//   2. city.defaultLat/Lng/Zoom del CityProvider (si ciudad seleccionada)
//   3. DEFAULT_CENTER como último recurso defensivo
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { activityPath } from '@/lib/activity-url';
import { useCity } from '@/components/providers/CityProvider';

export interface MapMarker {
  id:           string;
  title:        string;
  lat:          number;
  lng:          number;
  category:     string | null;
  locationName: string;
  priceLabel:   string;
}

interface Props {
  searchParams: string; // ?q=... para /api/activities/map
  height?: string;
}

// Último recurso defensivo (jambás debería usarse si CityProvider está montado)
const EMERGENCY_CENTER: [number, number] = [4.711, -74.0721];
const EMERGENCY_ZOOM = 11;

export default function MapInner({ searchParams, height = '520px' }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<any>(null);        // instancia L.Map
  const layerGroupRef = useRef<any>(null);        // L.LayerGroup para los pines

  const { city } = useCity();

  const [markers,  setMarkers]  = useState<MapMarker[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // ── Fetch markers cuando cambian los filtros ─────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/activities/map${searchParams ? `?${searchParams}` : ''}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setMarkers(data.markers ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError('No se pudo cargar el mapa');
        setLoading(false);
      });
  }, [searchParams]);

  // ── Inicializar mapa Leaflet (una sola vez) ───────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import('leaflet').then((L) => {
      // Fix CSS con import dinámico
      const link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const map = L.map(containerRef.current!, {
        // Centro inicial neutro: será sobreescrito por fitBounds o city.defaultCenter
        center: city
          ? [city.defaultLat, city.defaultLng] as [number, number]
          : EMERGENCY_CENTER,
        zoom: city ? city.defaultZoom : EMERGENCY_ZOOM,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current        = null;
      layerGroupRef.current = null;
    };
  }, []);

  // ── Actualizar pines cuando cambian los datos ─────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;

    import('leaflet').then((L) => {
      const lg = layerGroupRef.current;
      if (!lg) return;
      lg.clearLayers();

      if (markers.length === 0) return;

      // Icono personalizado: pin índigo con rotación clásica
      const makeIcon = () => L.divIcon({
        html: `<div style="
          width:26px;height:26px;
          background:#4f46e5;
          border:3px solid #fff;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 2px 8px rgba(0,0,0,.35);
          cursor:pointer;
        "></div>`,
        className: '',
        iconSize:    [26, 26],
        iconAnchor:  [13, 26],
        popupAnchor: [0, -28],
      });

      markers.forEach((m) => {
        const href = activityPath(m.id, m.title);
        const popup = /* html */`
          <div style="min-width:200px;font-family:system-ui,sans-serif;line-height:1.4">
            <p style="font-weight:700;font-size:13px;margin:0 0 5px;color:#111">${escHtml(m.title)}</p>
            ${m.category ? `<span style="
              display:inline-block;background:#ede9fe;color:#5b21b6;
              border-radius:20px;padding:1px 8px;font-size:11px;margin-bottom:6px
            ">${escHtml(m.category)}</span>` : ''}
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#555;margin-bottom:8px">
              <span>📍 ${escHtml(m.locationName)}</span>
              ${m.priceLabel ? `<span style="font-weight:600;color:${m.priceLabel === 'Gratis' ? '#059669' : '#374151'}">${escHtml(m.priceLabel)}</span>` : ''}
            </div>
            <a href="${href}" style="
              display:block;background:#4f46e5;color:#fff;
              text-align:center;border-radius:8px;padding:6px 12px;
              font-size:12px;font-weight:600;text-decoration:none
            ">Ver actividad →</a>
          </div>
        `;

        L.marker([m.lat, m.lng], { icon: makeIcon() })
          .addTo(lg)
          .bindPopup(popup, { maxWidth: 260 });
      });

      // Ajustar vista para mostrar todos los pines
      if (markers.length === 1) {
        mapRef.current.setView([markers[0].lat, markers[0].lng], 14);
      } else if (markers.length > 1) {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
        mapRef.current.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
      } else if (city) {
        // Sin pines pero con ciudad seleccionada: centrar en coordenadas de la ciudad
        mapRef.current.setView([city.defaultLat, city.defaultLng], city.defaultZoom);
      }
      // Sin pines ni ciudad: el map quedó en el centro inicial (EMERGENCY_CENTER)
    });
  }, [markers, city]);

  const isEmpty = !loading && !error && markers.length === 0;

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-[var(--hp-border)] shadow-sm"
      style={{ height }}
    >
      {/* Overlay: loading */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--hp-bg-page)] gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm text-[var(--hp-text-secondary)]">Cargando mapa...</p>
        </div>
      )}

      {/* Overlay: error */}
      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--hp-bg-page)]">
          <p className="text-sm text-error-500">{error}</p>
        </div>
      )}

      {/* Overlay: sin resultados */}
      {isEmpty && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--hp-bg-page)] gap-2">
          <span className="text-4xl">🗺</span>
          <p className="text-sm text-[var(--hp-text-secondary)]">No hay actividades con ubicación para estos filtros</p>
        </div>
      )}

      {/* Contador flotante */}
      {!loading && !error && markers.length > 0 && (
        <div className="absolute bottom-4 left-4 z-20 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-[var(--hp-text-primary)] shadow-md backdrop-blur-sm">
          {markers.length} {markers.length === 1 ? 'actividad' : 'actividades'} en el mapa
        </div>
      )}

      {/* Contenedor del mapa */}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

/** Escapa HTML básico para el contenido del popup */
function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
