'use client';
// =============================================================================
// MapView — wrapper del mapa de actividades
// cityId SIEMPRE viene de CityProvider (no del prop del server component).
// Esto evita el double-fetch causado por router.replace() del CityProvider
// al normalizar la URL con ?cityId=xxx tras el primer render.
// =============================================================================

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useCity } from '@/components/providers/CityProvider';

// Sin SSR: Leaflet requiere window
const MapInner = dynamic(() => import('./MapInner'), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center rounded-2xl bg-[var(--hp-bg-subtle)] animate-pulse border border-[var(--hp-border)]"
      style={{ height: '520px' }}
    >
      <p className="text-sm text-[var(--hp-text-muted)]">Cargando mapa...</p>
    </div>
  ),
});

// cityId excluido de props — se lee de CityProvider directamente
interface MapViewProps {
  search:     string;
  ageMin:     string;
  ageMax:     string;
  categoryId: string;
  type:       string;
  audience:   string;
  price:      string;
}

export function MapView({ search, ageMin, ageMax, categoryId, type, audience, price }: MapViewProps) {
  const { city } = useCity();

  // cityId del CityProvider: estable desde el primer render, no cambia con router.replace
  const searchParams = useMemo(() => {
    const sp = new URLSearchParams();
    if (search)     sp.set('search',     search);
    if (ageMin)     sp.set('ageMin',     ageMin);
    if (ageMax)     sp.set('ageMax',     ageMax);
    if (categoryId) sp.set('categoryId', categoryId);
    if (type)       sp.set('type',       type);
    if (audience)   sp.set('audience',   audience);
    if (price)      sp.set('price',      price);
    if (city?.id)   sp.set('cityId',     city.id);
    return sp.toString();
  }, [search, ageMin, ageMax, categoryId, type, audience, price, city]);

  return <MapInner searchParams={searchParams} height="520px" />;
}
