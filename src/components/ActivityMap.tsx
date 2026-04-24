'use client'

// =============================================================================
// ActivityMap — Mapa Leaflet de actividades (client-only, ssr: false)
// Centro dinámico: fitBounds sobre pines reales.
// Si no hay pines (ciudad sin actividades geocodificadas), usa city.defaultCenter.
// =============================================================================

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { activityPath } from '@/lib/activity-url'

export interface MapPoint {
  id: string
  title: string
  imageUrl: string | null
  priceLabel: string | null
  category: string | null
  provider: string | null
  lat: number
  lng: number
}

interface Props {
  points: MapPoint[]
  /** Coordenadas por defecto de la ciudad seleccionada (de City.defaultLat/Lng/Zoom) */
  defaultCenter?: { lat: number; lng: number; zoom: number }
}

// Colores por categoría (primer char del nombre → hash simple)
function markerColor(category: string | null): string {
  const colors = ['#f97316', '#8b5cf6', '#0ea5e9', '#10b981', '#f43f5e', '#eab308']
  if (!category) return colors[0]
  return colors[category.charCodeAt(0) % colors.length]
}

export default function ActivityMap({ points, defaultCenter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    import('leaflet').then((L) => {
      if (!containerRef.current || mapRef.current) return

      // Fix default icon paths (webpack/Next.js issue con Leaflet)
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      // Centro inicial neutro — será sobreescrito por fitBounds o defaultCenter
      const map = L.map(containerRef.current).setView([4.7110, -74.0721], 12)
      mapRef.current = map

      // Tiles OpenStreetMap (sin API key)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map)

      // Pins de actividades
      const markers: any[] = []
      points.forEach((point) => {
        const color = markerColor(point.category)

        const icon = L.divIcon({
          className: '',
          html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        })

        const path = activityPath(point.id, point.title)
        const imgTag = point.imageUrl
          ? `<img src="${point.imageUrl}" alt="" style="width:100%;height:72px;object-fit:cover;border-radius:6px;margin-bottom:6px"/>`
          : ''
        const price = point.priceLabel
          ? `<span style="font-size:11px;background:${point.priceLabel === 'Gratis' ? '#d1fae5' : '#fed7aa'};color:${point.priceLabel === 'Gratis' ? '#065f46' : '#7c2d12'};padding:1px 6px;border-radius:999px">${point.priceLabel}</span>`
          : ''

        const popup = `
          <div style="width:180px;font-family:system-ui,sans-serif">
            ${imgTag}
            <p style="margin:0 0 4px;font-weight:600;font-size:13px;line-height:1.3">${point.title}</p>
            ${point.category ? `<p style="margin:0 0 4px;font-size:11px;color:#6b7280">${point.category}</p>` : ''}
            ${price}
            <a href="${path}" style="display:block;margin-top:8px;text-align:center;background:#f97316;color:white;padding:4px 0;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">Ver actividad →</a>
          </div>`

        const marker = L.marker([point.lat, point.lng], { icon })
          .addTo(map)
          .bindPopup(popup, { maxWidth: 200 })
        markers.push(marker)
      })

      // ── Centro dinámico ───────────────────────────────────────────────────
      // fitBounds si hay pines reales (evita fitBounds([]) que rompe Leaflet)
      if (markers.length > 0) {
        const group = L.featureGroup(markers)
        map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 15 })
      } else if (defaultCenter) {
        // Ciudad sin pines geocodificados → coordenadas base de la ciudad en DB
        map.setView([defaultCenter.lat, defaultCenter.lng], defaultCenter.zoom)
      }
      // Sin pines ni defaultCenter → el setView inicial queda como último recurso
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [points, defaultCenter])

  return (
    <div
      ref={containerRef}
      style={{ height: '580px', width: '100%' }}
      className="rounded-2xl overflow-hidden"
    />
  )
}
