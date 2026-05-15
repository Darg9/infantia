'use client';
// =============================================================================
// HeroSearchLoader — Interaction-first hydration para HeroSearch
//
// Estrategia: renderiza HeroSearchPlaceholder (HTML puro, 0 KB de JS) hasta
// que el usuario interactúa (hover o focus). Solo entonces descarga el chunk.
//
// SIN idle-preload: requestIdleCallback con timeout corto dispara el import()
// durante la ventana de medición de TBT en Lighthouse (CPU throttled 4×),
// causando una tarea masiva exactamente cuando no queremos. El chunk carga
// bajo demanda — en conexiones normales <100ms, imperceptible para el usuario.
// =============================================================================

import { useState, useCallback, useRef } from 'react';
import { HeroSearchPlaceholder } from './HeroSearchPlaceholder';

type HeroSearchComponent = React.ComponentType<{
  unified?: boolean;
  autoFocus?: boolean;
}>;

export function HeroSearchLoader({ unified }: { unified?: boolean }) {
  const [active, setActive]          = useState(false);
  const [activatedByFocus, setFocus] = useState(false);
  const [HeroSearch, setHeroSearch]  = useState<HeroSearchComponent | null>(null);
  const loadCalled                   = useRef(false);

  const loadModule = useCallback(() => {
    if (loadCalled.current) return;
    loadCalled.current = true;
    import('@/app/_components/HeroSearch').then((m) => {
      setHeroSearch(() => m.default as HeroSearchComponent);
    });
  }, []);

  const handleMouseEnter = useCallback(() => {
    loadModule();
    setActive(true);
  }, [loadModule]);

  const handleFocus = useCallback(() => {
    loadModule();
    setActive(true);
    setFocus(true);
  }, [loadModule]);

  if (active && HeroSearch) {
    return <HeroSearch unified={unified} autoFocus={activatedByFocus} />;
  }

  return (
    <div onMouseEnter={handleMouseEnter} onFocus={handleFocus}>
      <HeroSearchPlaceholder unified={unified} />
    </div>
  );
}
