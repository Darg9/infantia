'use client';
// =============================================================================
// useActivityHistory — Historial de actividades vistas (localStorage)
//
// Arquitectura:
//   - addToHistory / clearHistory: funciones puras testables (export directo)
//   - useActivityHistory: hook React que usa useLocalStorage (SSR-safe, React 19)
// =============================================================================

import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

const STORAGE_KEY = 'habitaplan:activity-history';
const MAX_ITEMS = 50;

export interface HistoryEntry {
  activityId: string;
  title: string;
  imageUrl: string | null;
  viewedAt: string; // ISO string
}

// ─── Funciones puras (testables sin React) ────────────────────────────────────

function readHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage lleno o no disponible
  }
}

/**
 * Añade una actividad al historial de vistas.
 * - Deduplica por activityId (mueve al frente si ya existe)
 * - Limita a MAX_ITEMS con política FIFO
 * - Asigna viewedAt = ahora
 */
export function addToHistory(entry: Omit<HistoryEntry, 'viewedAt'>): void {
  if (typeof window === 'undefined') return;
  const history = readHistory();
  const filtered = history.filter((h) => h.activityId !== entry.activityId);
  const newEntry: HistoryEntry = { ...entry, viewedAt: new Date().toISOString() };
  writeHistory([newEntry, ...filtered].slice(0, MAX_ITEMS));
}

/**
 * Elimina todo el historial de localStorage.
 */
export function clearHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage no disponible
  }
}

/**
 * Elimina una actividad específica del historial.
 */
export function removeFromHistory(activityId: string): void {
  if (typeof window === 'undefined') return;
  const history = readHistory();
  const filtered = history.filter((h) => h.activityId !== activityId);
  writeHistory(filtered);
}

// ─── Hook React (SSR-safe con patrón mounted, React 19) ───────────────────────

/**
 * Hook para acceder y gestionar el historial de actividades.
 * Usa useLocalStorage (patrón mounted) para evitar hydration mismatches en React 19.
 *
 * Retorna `mounted=false` durante SSR → muestra skeleton antes de leer localStorage.
 */
export function useActivityHistory() {
  const [history, setHistory, mounted] = useLocalStorage<HistoryEntry[]>(STORAGE_KEY, []);

  const add = useCallback(
    (entry: Omit<HistoryEntry, 'viewedAt'>) => {
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.activityId !== entry.activityId);
        const newEntry: HistoryEntry = { ...entry, viewedAt: new Date().toISOString() };
        return [newEntry, ...filtered].slice(0, MAX_ITEMS);
      });
    },
    [setHistory]
  );

  const clear = useCallback(() => {
    setHistory([]);
  }, [setHistory]);

  const remove = useCallback(
    (activityId: string) => {
      setHistory((prev) => prev.filter((h) => h.activityId !== activityId));
    },
    [setHistory]
  );

  return { history, addToHistory: add, clearHistory: clear, removeFromHistory: remove, mounted };
}
