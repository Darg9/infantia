'use client';
// =============================================================================
// /perfil/historial — Historial de actividades vistas (localStorage)
//
// PATRÓN MOUNTED: Durante SSR renderiza vacío → sin hydration mismatch.
// Después del mount, lee localStorage. Esto evita conflictos con React 19.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { activityPath } from '@/lib/activity-url';

const STORAGE_KEY = 'habitaplan:activity-history';

interface HistoryEntry {
  activityId: string;
  title: string;
  imageUrl: string | null;
  viewedAt: string;
}

function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days}d`;
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  });
}

export default function HistorialPage() {
  // ── Patrón mounted: evita hydration mismatch en React 19 ─────────────────
  // SSR → mounted=false → renderiza vacío (sin acceso a localStorage)
  // Client → mounted=true → lee localStorage y muestra el historial real
  const [mounted, setMounted] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(readHistory());
    setMounted(true);
  }, []);

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage no disponible
    }
    setHistory([]);
  }, []);

  // ── Skeleton durante SSR y primer render ─────────────────────────────────
  if (!mounted) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-[var(--hp-text-primary)]">Historial</h1>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl p-3 animate-pulse"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--hp-bg-subtle)] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-[var(--hp-bg-subtle)] rounded w-3/4" />
                <div className="h-3 bg-[var(--hp-bg-subtle)] rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--hp-text-primary)]">Historial</h1>
          {history.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
              {history.length}
            </span>
          )}
        </div>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
          >
            Borrar historial
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <span className="text-6xl">🕐</span>
          <p className="text-gray-600 font-medium text-lg">No has visto actividades recientemente</p>
          <p className="text-sm text-[var(--hp-text-muted)] max-w-sm">
            Cuando visites una actividad, aparecerá aquí para que puedas volver a encontrarla.
          </p>
          <Link
            href="/actividades"
            className="mt-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            Explorar actividades
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => (
            <Link
              key={entry.activityId}
              href={activityPath(entry.activityId, entry.title)}
              className="flex items-center gap-4 bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl p-3 hover:border-brand-300 transition-colors group"
            >
              {entry.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.imageUrl}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[var(--hp-bg-page)] flex items-center justify-center text-xl shrink-0">
                  🎨
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--hp-text-primary)] group-hover:text-brand-600 transition-colors truncate">
                  {entry.title}
                </p>
                <p className="text-xs text-[var(--hp-text-muted)]">{timeAgo(entry.viewedAt)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
