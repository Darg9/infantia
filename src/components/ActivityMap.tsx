'use client'

// =============================================================================
// ActivityMap — Mapa Leaflet de actividades (client-only, ssr: false)
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
}

// Colores por categoría (primer char del nombre → hash simple)
function markerColor(category: string | null): string {
  const colors = ['#f97316', '#8b5cf6', '#0ea5e9', '#10b981', '#f43f5e', '#eab308']
  if (!category) return colors[0]
  return colors[category.charCodeAt(0) % colors.length]
}

export default function ActivityMap({ points }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Import dinámico para evitar SSR (CSS ya importado arriba)
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

      const map = L.map(containerRef.current).setView([4.7110, -74.0721], 12)
      mapRef.current = map

      // Tiles OpenStreetMap (sin API key)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map)

      // Pins de actividades
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

        L.marker([point.lat, point.lng], { icon })
          .addTo(map)
          .bindPopup(popup, { maxWidth: 200 })
      })
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [points])

  return (
    <div
      ref={containerRef}
      style={{ height: '580px', width: '100%' }}
      className="rounded-2xl overflow-hidden"
    />
  )
}
