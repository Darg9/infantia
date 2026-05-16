'use client';
// =============================================================================
// SyncCityId — Sincroniza el CityProvider con la ciudad de la landing page
//
// Problema: cuando el usuario llega a /actividades/[citySlug] con su ciudad
// preferida (ej. Medellín) en localStorage, el CityProvider inyecta el cityId
// de Medellín en la URL, haciendo que el header muestre "Medellín" aunque la
// página es de Bogotá. Este componente fuerza la sincronía en el mount.
// =============================================================================

import { useEffect, useRef } from 'react';
import { useCity } from '@/components/providers/CityProvider';

interface Props {
  cityId: string;
}

export function SyncCityId({ cityId }: Props) {
  const { cityId: currentCityId, setCityId } = useCity();
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current) return;
    if (currentCityId !== cityId) {
      setCityId(cityId);
    }
    synced.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
