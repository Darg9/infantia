'use client';

// =============================================================================
// Panel de Revisión — Pipeline V2
//
// UX optimizada para velocidad de decisión:
//   A → Aprobar     R → Rechazar     ← / → navegación entre cards
//
// Dos columnas: Institucionales | Otras fuentes
// =============================================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface GateSnapshot {
  gate_score: number;
  gate_reason: string;
  source_trust: number;
  is_institutional: boolean;
  gate_signals: {
    hasIntentSignal: boolean;
    hasTimeSignal: boolean;
    hasLocationSignal: boolean;
    noiseDetected: boolean;
  };
}

interface PendingActivity {
  id: string;
  title: string;
  description: string;
  sourceDomain: string;
  sourceUrl: string;
  imageUrl: string | null;
  createdAt: string;
  categories: string[];
  city: string | null;
  provider: string | null;
  isInstitutional: boolean;
  gate: GateSnapshot | null;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalInstitutional: number;
  totalOther: number;
  total: number;
}

// ── Componente Card ────────────────────────────────────────────────────────────

function ActivityCard({
  activity,
  isSelected,
  onApprove,
  onReject,
  busy,
}: {
  activity: PendingActivity;
  isSelected: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  busy: string | null;
}) {
  const isBusy = busy === activity.id;
  const score  = activity.gate?.gate_score ?? null;

  const scoreColor =
    score === null ? 'text-[var(--hp-text-muted)]'
    : score >= 0.4 ? 'text-success-700'
    : score >= 0.2 ? 'text-warning-700'
    : 'text-error-600';

  return (
    <div
      className={`
        rounded-xl border p-4 transition-all flex flex-col gap-2
        ${isSelected
          ? 'border-brand-500 ring-2 ring-brand-300 bg-[var(--hp-bg-elevated)]'
          : 'border-[var(--hp-border)] bg-[var(--hp-bg-surface)] hover:border-brand-300'}
      `}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        {activity.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activity.imageUrl}
            alt=""
            className="w-14 h-14 rounded-lg object-cover shrink-0 bg-[var(--hp-bg-page)]"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--hp-text-primary)] text-sm leading-tight line-clamp-2">
            {activity.title}
          </p>
          <p className="text-xs text-[var(--hp-text-muted)] mt-0.5 truncate">
            {activity.sourceDomain} {activity.city ? `· ${activity.city}` : ''}
          </p>
        </div>
        {score !== null && (
          <span className={`text-xs font-mono font-bold shrink-0 ${scoreColor}`}>
            {score.toFixed(2)}
          </span>
        )}
      </div>

      {/* Descripción */}
      <p className="text-xs text-[var(--hp-text-secondary)] line-clamp-3 leading-relaxed">
        {activity.description}
      </p>

      {/* Categorías */}
      {activity.categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {activity.categories.map((c) => (
            <span
              key={c}
              className="px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-xs font-medium"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Gate signals */}
      {activity.gate?.gate_signals && (
        <div className="text-[10px] text-[var(--hp-text-muted)] flex flex-wrap gap-x-2">
          {activity.gate.gate_signals.hasIntentSignal  && <span>✓ intención</span>}
          {activity.gate.gate_signals.hasTimeSignal    && <span>✓ fecha</span>}
          {activity.gate.gate_signals.hasLocationSignal && <span>✓ lugar</span>}
          {activity.gate.gate_signals.noiseDetected    && <span className="text-error-500">⚠ ruido</span>}
          <span>trust: {(activity.gate.source_trust * 100).toFixed(0)}%</span>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onApprove(activity.id)}
          disabled={!!busy}
          className="flex-1 py-1.5 rounded-lg bg-success-100 text-success-700 text-xs font-bold hover:bg-success-200 disabled:opacity-40 transition-colors"
        >
          {isBusy ? '...' : '✅ Aprobar (A)'}
        </button>
        <button
          onClick={() => onReject(activity.id)}
          disabled={!!busy}
          className="flex-1 py-1.5 rounded-lg bg-error-50 text-error-600 text-xs font-bold hover:bg-error-100 disabled:opacity-40 transition-colors"
        >
          {isBusy ? '...' : '❌ Rechazar (R)'}
        </button>
        <a
          href={activity.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg border border-[var(--hp-border)] text-xs text-[var(--hp-text-muted)] hover:border-brand-400 transition-colors"
          title="Ver fuente original"
        >
          🔗
        </a>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PendingReviewPage() {
  const [tab,              setTab]     = useState<'institutional' | 'other'>('institutional');
  const [activities,       setActs]    = useState<PendingActivity[]>([]);
  const [pagination,       setPag]     = useState<PaginationInfo | null>(null);
  const [page,             setPage]    = useState(1);
  const [loading,          setLoading] = useState(true);
  const [busy,             setBusy]    = useState<string | null>(null);
  const [selectedIdx,      setSelected] = useState(0);
  const [toast,            setToast]   = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const listRef = useRef<PendingActivity[]>([]);
  listRef.current = activities;

  // ── Carga ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pending-review?type=${tab}&page=${page}`);
      const json = await res.json() as { activities: PendingActivity[]; pagination: PaginationInfo };
      setActs(json.activities);
      setPag(json.pagination);
      setSelected(0);
    } catch {
      showToast('Error cargando actividades', 'err');
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => { void load(); }, [load]);

  // ── Toast ──────────────────────────────────────────────────────────────────
  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Decisión ───────────────────────────────────────────────────────────────
  const decide = useCallback(async (id: string, decision: 'approve' | 'reject') => {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/pending-review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision }),
      });
      const json = await res.json() as { message?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error');
      showToast(json.message ?? 'OK', 'ok');
      setActs((prev) => prev.filter((a) => a.id !== id));
      setSelected((prev) => Math.max(0, prev));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error', 'err');
    } finally {
      setBusy(null);
    }
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      const acts = listRef.current;
      if (acts.length === 0) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((i) => Math.min(i + 1, acts.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((i) => Math.max(i - 1, 0));
      } else if (e.key === 'a' || e.key === 'A') {
        const act = acts[selectedIdx];
        if (act && !busy) void decide(act.id, 'approve');
      } else if (e.key === 'r' || e.key === 'R') {
        const act = acts[selectedIdx];
        if (act && !busy) void decide(act.id, 'reject');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIdx, busy, decide]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--hp-bg-page)] pb-16">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-xl shadow-lg text-sm font-semibold
            ${toast.type === 'ok' ? 'bg-success-100 text-success-800' : 'bg-error-100 text-error-800'}`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--hp-text-primary)]">
              Revisión de actividades
            </h1>
            <p className="text-sm text-[var(--hp-text-muted)] mt-0.5">
              Pipeline V2 — Atajos: <kbd className="px-1 py-0.5 bg-[var(--hp-bg-elevated)] rounded text-xs border">A</kbd> Aprobar &nbsp;
              <kbd className="px-1 py-0.5 bg-[var(--hp-bg-elevated)] rounded text-xs border">R</kbd> Rechazar &nbsp;
              <kbd className="px-1 py-0.5 bg-[var(--hp-bg-elevated)] rounded text-xs border">← →</kbd> Navegar
            </p>
          </div>
          <Link href="/admin" className="text-sm text-[var(--hp-text-muted)] hover:text-[var(--hp-text-primary)]">
            ← Admin
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[var(--hp-bg-elevated)] p-1 rounded-xl w-fit">
          {(['institutional', 'other'] as const).map((t) => {
            const count = t === 'institutional' ? pagination?.totalInstitutional : pagination?.totalOther;
            return (
              <button
                key={t}
                onClick={() => { setTab(t); setPage(1); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tab === t
                    ? 'bg-[var(--hp-bg-surface)] shadow text-[var(--hp-text-primary)]'
                    : 'text-[var(--hp-text-muted)] hover:text-[var(--hp-text-primary)]'
                }`}
              >
                {t === 'institutional' ? '🏛 Institucionales' : '🌐 Otras fuentes'}
                {count !== undefined && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold
                    ${count > 0 ? 'bg-brand-100 text-brand-700' : 'bg-[var(--hp-bg-page)] text-[var(--hp-text-muted)]'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Grid de cards */}
        {loading ? (
          <p className="text-[var(--hp-text-muted)] text-sm">Cargando...</p>
        ) : activities.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🎉</p>
            <p className="text-lg font-semibold text-[var(--hp-text-primary)]">
              Sin pendientes en esta categoría
            </p>
            <p className="text-sm text-[var(--hp-text-muted)] mt-1">
              Las próximas actividades del Pipeline V2 aparecerán aquí.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activities.map((act, idx) => (
                <ActivityCard
                  key={act.id}
                  activity={act}
                  isSelected={idx === selectedIdx}
                  onApprove={(id) => void decide(id, 'approve')}
                  onReject={(id)  => void decide(id, 'reject')}
                  busy={busy}
                />
              ))}
            </div>

            {/* Paginación */}
            {pagination && pagination.total > pagination.pageSize && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-4 py-2 rounded-lg border border-[var(--hp-border)] text-sm disabled:opacity-40 hover:bg-[var(--hp-bg-elevated)] transition-colors"
                >
                  ← Anterior
                </button>
                <span className="px-4 py-2 text-sm text-[var(--hp-text-muted)]">
                  Pág. {page}
                </span>
                <button
                  disabled={activities.length < pagination.pageSize}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 rounded-lg border border-[var(--hp-border)] text-sm disabled:opacity-40 hover:bg-[var(--hp-bg-elevated)] transition-colors"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
