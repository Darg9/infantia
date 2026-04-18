'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReviewEntry {
  id: string;
  raw_input: string;
  normalized_input: string;
  suggested_city_id: string | null;
  suggested_city_name: string | null;
  similarity_score: number;
  created_at: string;
}

interface City {
  id: string;
  name: string;
}

interface Props {
  cities: City[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 0.9) return 'text-success-600';
  if (score >= 0.75) return 'text-warning-600';
  return 'text-error-600';
}

function scoreBg(score: number): string {
  if (score >= 0.9) return 'bg-success-50';
  if (score >= 0.75) return 'bg-warning-50';
  return 'bg-error-50';
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CityReviewClient({ cities }: Props) {
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Per-row state
  const [rowLoading, setRowLoading] = useState<Record<string, boolean>>({});
  const [rowFeedback, setRowFeedback] = useState<Record<string, string>>({});
  const [showReassign, setShowReassign] = useState<Record<string, boolean>>({});
  const [reassignCity, setReassignCity] = useState<Record<string, string>>({});

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    setPageLoading(true);
    setPageError(null);
    try {
      const res = await fetch('/api/admin/cities/review');
      if (!res.ok) throw new Error('Error al cargar la cola de revisión');
      const data: ReviewEntry[] = await res.json();
      setEntries(data);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ── Row helpers ────────────────────────────────────────────────────────────

  function setRowBusy(id: string, busy: boolean) {
    setRowLoading((prev) => ({ ...prev, [id]: busy }));
  }

  function setRowMsg(id: string, msg: string) {
    setRowFeedback((prev) => ({ ...prev, [id]: msg }));
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleApprove(entry: ReviewEntry) {
    if (!entry.suggested_city_id) {
      setRowMsg(entry.id, 'Sin ciudad sugerida — usa Reasignar');
      return;
    }
    setRowBusy(entry.id, true);
    setRowMsg(entry.id, '');
    try {
      const res = await fetch('/api/admin/cities/review/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id }),
      });
      if (!res.ok) throw new Error('Error al aprobar');
      removeEntry(entry.id);
    } catch {
      setRowBusy(entry.id, false);
      setRowMsg(entry.id, '✗ Error al aprobar');
    }
  }

  async function handleReassign(id: string) {
    const cityId = reassignCity[id];
    if (!cityId) {
      setRowMsg(id, 'Selecciona una ciudad');
      return;
    }
    setRowBusy(id, true);
    setRowMsg(id, '');
    try {
      const res = await fetch('/api/admin/cities/review/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cityId }),
      });
      if (!res.ok) throw new Error('Error al reasignar');
      removeEntry(id);
    } catch {
      setRowBusy(id, false);
      setRowMsg(id, '✗ Error al reasignar');
    }
  }

  async function handleIgnore(id: string) {
    setRowBusy(id, true);
    setRowMsg(id, '');
    try {
      const res = await fetch(`/api/admin/cities/review/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error al ignorar');
      removeEntry(id);
    } catch {
      setRowBusy(id, false);
      setRowMsg(id, '✗ Error al ignorar');
    }
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div className="text-center py-12 text-[var(--hp-text-muted)] text-sm">
        Cargando cola de revisión…
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="bg-error-50 border border-error-200 rounded-2xl p-4 text-error-700 text-sm">
        {pageError}{' '}
        <button
          onClick={fetchEntries}
          className="underline hover:no-underline ml-1"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 bg-success-50 border border-success-200 rounded-2xl">
        <p className="text-success-700 font-semibold text-lg">✅ Cola vacía</p>
        <p className="text-success-600 text-sm mt-1">
          No hay ciudades pendientes de revisión.
        </p>
      </div>
    );
  }

  // ── Table ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--hp-text-secondary)]">
        {entries.length} entrada{entries.length !== 1 ? 's' : ''} pendiente
        {entries.length !== 1 ? 's' : ''} · ordenadas por score ASC (más
        dudosas arriba) · límite 50
      </p>

      <div className="overflow-x-auto rounded-2xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--hp-bg-page)] border-b border-[var(--hp-border)] text-xs text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Input original</th>
              <th className="px-4 py-3 text-left font-medium">Normalizado</th>
              <th className="px-4 py-3 text-left font-medium">Ciudad sugerida</th>
              <th className="px-4 py-3 text-center font-medium">Score</th>
              <th className="px-4 py-3 text-left font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map((entry) => {
              const busy = rowLoading[entry.id] ?? false;
              const feedback = rowFeedback[entry.id] ?? '';
              const isReassigning = showReassign[entry.id] ?? false;
              const feedbackIsError = feedback.startsWith('✗');

              return (
                <tr
                  key={entry.id}
                  className={`transition-opacity ${busy ? 'opacity-40 pointer-events-none' : 'hover:bg-[var(--hp-bg-page)]'}`}
                >
                  {/* Raw input */}
                  <td className="px-4 py-3 max-w-[180px]">
                    <span className="font-mono text-[var(--hp-text-primary)] break-words">
                      {entry.raw_input}
                    </span>
                  </td>

                  {/* Normalized */}
                  <td className="px-4 py-3 max-w-[160px]">
                    <span className="font-mono text-xs text-[var(--hp-text-secondary)] break-words">
                      {entry.normalized_input}
                    </span>
                  </td>

                  {/* Suggested city */}
                  <td className="px-4 py-3">
                    {entry.suggested_city_name ? (
                      <span className="text-[var(--hp-text-primary)]">
                        {entry.suggested_city_name}
                      </span>
                    ) : (
                      <span className="text-[var(--hp-text-muted)] italic text-xs">
                        Sin sugerencia
                      </span>
                    )}
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${scoreColor(entry.similarity_score)} ${scoreBg(entry.similarity_score)}`}
                    >
                      {Math.round(entry.similarity_score * 100)}%
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 min-w-[260px]">
                    <div className="flex flex-col gap-1.5">
                      {!isReassigning ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Approve — solo si hay sugerencia */}
                          {entry.suggested_city_id && (
                            <button
                              onClick={() => handleApprove(entry)}
                              disabled={busy}
                              className="px-3 py-1 text-xs font-medium bg-success-100 text-success-700 hover:bg-success-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              ✓ Aprobar
                            </button>
                          )}

                          {/* Reassign toggle */}
                          <button
                            onClick={() =>
                              setShowReassign((prev) => ({
                                ...prev,
                                [entry.id]: true,
                              }))
                            }
                            disabled={busy}
                            className="px-3 py-1 text-xs font-medium bg-brand-100 text-brand-700 hover:bg-brand-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            ↔ Reasignar
                          </button>

                          {/* Ignore */}
                          <button
                            onClick={() => handleIgnore(entry.id)}
                            disabled={busy}
                            className="px-3 py-1 text-xs font-medium bg-gray-100 text-[var(--hp-text-secondary)] hover:bg-gray-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            × Ignorar
                          </button>
                        </div>
                      ) : (
                        /* ── Inline reassign form ── */
                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            value={reassignCity[entry.id] ?? ''}
                            onChange={(e) =>
                              setReassignCity((prev) => ({
                                ...prev,
                                [entry.id]: e.target.value,
                              }))
                            }
                            disabled={busy}
                            className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-40"
                          >
                            <option value="">Seleccionar ciudad…</option>
                            {cities.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => handleReassign(entry.id)}
                            disabled={busy}
                            className="px-3 py-1 text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Guardar
                          </button>

                          <button
                            onClick={() => {
                              setShowReassign((prev) => ({
                                ...prev,
                                [entry.id]: false,
                              }));
                              setRowMsg(entry.id, '');
                            }}
                            disabled={busy}
                            className="px-3 py-1 text-xs font-medium bg-gray-100 text-[var(--hp-text-secondary)] hover:bg-gray-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}

                      {/* Inline feedback */}
                      {feedback && (
                        <p
                          className={`text-xs ${feedbackIsError ? 'text-error-600' : 'text-[var(--hp-text-secondary)]'}`}
                        >
                          {feedback}
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
