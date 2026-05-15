'use client';
// =============================================================================
// HeroSearchLoader — Interaction-first hydration para HeroSearch
//
// Estrategia para reducir TBT mobile:
//   1. Renderiza HeroSearchPlaceholder (HTML puro, 0 KB de JS) hasta interacción.
//   2. requestIdleCallback preloads el chunk de HeroSearch en tiempo muerto
//      (post-TTI) → cuando el usuario interactúa, el módulo ya está en cache.
//   3. onFocus/onMouseEnter → activa HeroSearch con autoFocus si fue por foco,
//      recuperando la posición del cursor sin que el usuario lo note.
//
// Resultado: el chunk HeroSearch (~90 KB) no bloquea el hilo principal durante
// la ventana FCP→TTI, eliminando su contribución al TBT.
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { HeroSearchPlaceholder } from './HeroSearchPlaceholder';

type HeroSearchComponent = React.ComponentType<{
  unified?: boolean;
  autoFocus?: boolean;
}>;

export function HeroSearchLoader({ unified }: { unified?: boolean }) {
  // active: el usuario interactuó → mostrar HeroSearch cuando el módulo esté listo
  const [active, setActive]             = useState(false);
  // activatedByFocus: el swap fue por foco → pasar autoFocus para recuperar cursor
  const [activatedByFocus, setFocus]    = useState(false);
  // HeroSearch: la referencia al componente, disponible tras import()
  const [HeroSearch, setHeroSearch]     = useState<HeroSearchComponent | null>(null);
  // Evitar múltiples llamadas a import()
  const loadCalled = useRef(false);

  const loadModule = useCallback(() => {
    if (loadCalled.current) return;
    loadCalled.current = true;
    import('@/app/_components/HeroSearch').then((m) => {
      // Forma funcional obligatoria: React trataría m.default como updater function
      // si se pasa directamente. () => m.default lo almacena como valor.
      setHeroSearch(() => m.default as HeroSearchComponent);
    });
  }, []);

  // requestIdleCallback: descarga el chunk cuando el browser está ocioso
  // (post-TTI). No rendereamos HeroSearch aquí — solo preloading silencioso.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cleanup: (() => void) | undefined;

    if ('requestIdleCallback' in window) {
      // TypeScript 5 incluye requestIdleCallback en lib.dom, pero usamos
      // la guarda 'in window' para entornos sin soporte (Safari <16.4).
      const ric = window.requestIdleCallback as (
        cb: () => void,
        opts?: { timeout: number }
      ) => number;
      const cic = window.cancelIdleCallback as (id: number) => void;
      const id = ric(loadModule, { timeout: 3000 });
      cleanup = () => cic(id);
    } else {
      // Fallback: setTimeout 2.5s (>TTI típico en conexión media)
      const t = setTimeout(loadModule, 2500);
      cleanup = () => clearTimeout(t);
    }

    return cleanup;
  }, [loadModule]);

  const handleMouseEnter = useCallback(() => {
    loadModule();
    setActive(true);
  }, [loadModule]);

  const handleFocus = useCallback(() => {
    loadModule();
    setActive(true);
    setFocus(true);
  }, [loadModule]);

  // Renderizar HeroSearch solo cuando el usuario interactuó Y el módulo está listo.
  // Si active=true pero el módulo aún no cargó → seguimos mostrando el placeholder
  // (el chunk ya está en descarga, tarda <100 ms en conexiones normales).
  if (active && HeroSearch) {
    return <HeroSearch unified={unified} autoFocus={activatedByFocus} />;
  }

  return (
    <div onMouseEnter={handleMouseEnter} onFocus={handleFocus}>
      <HeroSearchPlaceholder unified={unified} />
    </div>
  );
}
