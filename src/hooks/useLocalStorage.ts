'use client';
// =============================================================================
// useLocalStorage<T> — Hook seguro para localStorage en React 19 + Next.js SSR
// =============================================================================
//
// PROBLEMA:
//   En React 19 (usado en este proyecto), `useSyncExternalStore` lanza errores
//   de hidratación cuando el snapshot del servidor (vacío) difiere del cliente
//   (datos reales de localStorage). Esto causa pantalla negra en producción.
//
// SOLUCIÓN — Patrón "mounted":
//   1. Durante SSR → renderiza `initialValue` (sin acceso a localStorage)
//   2. Después del mount → lee localStorage y actualiza el estado
//   Resultado: servidor y cliente coinciden en hidratación → sin crash.
//
// USO:
//   const [value, setValue] = useLocalStorage<string[]>('mi-key', [])
//   setValue(['nuevo-valor'])  // escribe en localStorage automáticamente
//
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook seguro para localStorage en SSR + React 19.
 * Usa el patrón mounted para evitar hydration mismatches.
 *
 * @param key      - Clave de localStorage
 * @param initial  - Valor inicial mientras el componente no está montado (SSR)
 * @returns [value, setValue, mounted]
 *   - value:   valor actual (initial durante SSR, leído de LS después del mount)
 *   - setValue: función para actualizar el valor y persistirlo en LS
 *   - mounted:  true solo cuando estamos en cliente con LS disponible
 */
export function useLocalStorage<T>(
  key: string,
  initial: T
): [value: T, setValue: (v: T | ((prev: T) => T)) => void, mounted: boolean] {
  const [mounted, setMounted] = useState(false);
  const [value, setValueRaw] = useState<T>(initial);

  // Leer de localStorage después del mount (cliente)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        setValueRaw(JSON.parse(raw) as T);
      }
    } catch {
      // JSON malformado u otro error → usar valor inicial
    }
    setMounted(true);
  }, [key]);

  const setValue = useCallback(
    (update: T | ((prev: T) => T)) => {
      setValueRaw((prev) => {
        const next = typeof update === 'function'
          ? (update as (prev: T) => T)(prev)
          : update;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // localStorage lleno o no disponible
        }
        return next;
      });
    },
    [key]
  );

  return [value, setValue, mounted];
}
