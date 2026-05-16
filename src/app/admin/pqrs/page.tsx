'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, useToast } from '@/components/ui';
import { RESPONSE_CHANNELS, PQRS_SLA, type ResponseChannel } from '@/lib/pqrs';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type PqrsStatus = 'received' | 'in_progress' | 'closed';
type SlaLevel   = 'WARNING' | 'DUE_TODAY' | 'OVERDUE' | null;

interface SlaInfo {
  businessDays: number;
  limit:        number;
  level:        SlaLevel;
}

interface Pqrs {
  id:               string;
  createdAt:        string;
  name:             string | null;
  email:            string;
  category:         string;
  message:          string;
  dataRightType:    string | null;
  status:           PqrsStatus;
  statusChangedAt:  string | null;
  resolvedAt:       string | null;
  firstRespondedAt: string | null;
  responseChannel:  string | null;
  emailStatus:      string;
  sla:              SlaInfo;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<PqrsStatus, string> = {
  received:    'Recibida',
  in_progress: 'En proceso',
  closed:      'Cerrada',
};

const STATUS_COLORS: Record<PqrsStatus, string> = {
  received:    'bg-warning-100 text-warning-700',
  in_progress: 'bg-brand-50 text-brand-600',
  closed:      'bg-[var(--hp-bg-subtle)] text-[var(--hp-text-muted)]',
};

const CATEGORY_LABELS: Record<string, string> = {
  general:         'General',
  content_removal: 'Eliminación',
  data_access:     'Acceso datos',
  data_claim:      'Corrección datos',
  report_error:    'Reportar error',
  other:           'Otro',
};

const CATEGORY_LABELS_FULL: Record<string, string> = {
  general:         'Solicitud general',
  content_removal: 'Eliminación de contenido',
  data_access:     'Acceso a datos personales',
  data_claim:      'Corrección de datos',
  report_error:    'Reportar error',
  other:           'Otro',
};

const CHANNEL_LABELS: Record<ResponseChannel, string> = {
  email:    '✉️ Correo',
  phone:    '📞 Teléfono',
  whatsapp: '💬 WhatsApp',
  manual:   '📋 Manual',
  platform: '🖥️ Plataforma',
};

// ── SLA helpers ───────────────────────────────────────────────────────────────

function getSlaChip(sla: SlaInfo, status: PqrsStatus) {
  if (status === 'closed') {
    return { label: 'Cerrada', className: 'bg-[var(--hp-bg-subtle)] text-[var(--hp-text-muted)]' };
  }
  if (!sla.level) {
    return {
      label: `✅ Ok ${sla.businessDays}/${sla.limit}d`,
      className: 'bg-success-50 text-success-700',
    };
  }
  if (sla.level === 'WARNING') {
    return {
      label: `⚠️ Riesgo ${sla.businessDays}/${sla.limit}d`,
      className: 'bg-warning-100 text-warning-700',
    };
  }
  if (sla.level === 'DUE_TODAY') {
    return {
      label: `⏱️ Vence hoy ${sla.businessDays}d`,
      className: 'bg-orange-100 text-orange-700',
    };
  }
  // OVERDUE
  return {
    label: `🚨 Vencida ${sla.businessDays}d`,
    className: 'bg-error-50 text-error-600 font-semibold',
  };
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PqrsAdminPage() {
  const [items, setItems]         = useState<Pqrs[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatus] = useState<PqrsStatus | 'all'>('all');
  const [categoryFilter, setCat]  = useState('all');
  const [onlyOverdue, setOverdue] = useState(false);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [drawer, setDrawer]       = useState<Pqrs | null>(null);
  const [busy, setBusy]           = useState<string | null>(null);
  const [bulkBusy, setBulkBusy]   = useState(false);
  const [tick, setTick]           = useState(0);
  const { toast }                 = useToast();

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (onlyOverdue) params.set('overdue', 'true');

    const res = await fetch(`/api/admin/pqrs?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  // tick no es una dep "real" — es un contador de refresco manual
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter, onlyOverdue, tick]);

  useEffect(() => { load(); }, [load]);

  // ── PATCH individual ───────────────────────────────────────────────────────

  async function patch(id: string, data: {
    status?: PqrsStatus;
    responseChannel?: ResponseChannel;
  }) {
    setBusy(id);
    const res = await fetch(`/api/admin/pqrs/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    if (res.ok) {
      toast.success('Actualizado');
      setTick(t => t + 1);
      if (drawer?.id === id) setDrawer(null);
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? 'Error desconocido');
    }
    setBusy(null);
  }

  // ── Bulk close ─────────────────────────────────────────────────────────────

  async function bulkClose() {
    if (selected.size === 0) return;
    setBulkBusy(true);
    await Promise.all(
      [...selected].map((id) =>
        fetch(`/api/admin/pqrs/${id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ status: 'closed' }),
        })
      )
    );
    toast.success(`${selected.size} PQRS cerradas`);
    setSelected(new Set());
    setTick(t => t + 1);
    setBulkBusy(false);
  }

  // ── Selección ──────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const open = items.filter(i => i.status !== 'closed');
    if (selected.size === open.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(open.map(i => i.id)));
    }
  }

  const openItems = items.filter(i => i.status !== 'closed');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <a href="/admin" className="text-sm text-[var(--hp-text-muted)] hover:text-[var(--hp-text-primary)]">← Admin</a>
          <h1 className="text-2xl font-bold text-[var(--hp-text-primary)] mt-1">PQRS</h1>
          <p className="text-sm text-[var(--hp-text-secondary)]">
            {total} solicitudes · Ley 1581 / SIC
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Status pills */}
        <div className="flex gap-1.5">
          {(['all', 'received', 'in_progress', 'closed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setSelected(new Set()); }}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                statusFilter === s
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'border-[var(--hp-border)] text-[var(--hp-text-secondary)] hover:border-brand-300 hover:text-brand-600'
              }`}
            >
              {s === 'all' ? 'Todas' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Categoría */}
        <select
          value={categoryFilter}
          onChange={(e) => setCat(e.target.value)}
          className="text-sm border border-[var(--hp-border)] rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand-400 bg-[var(--hp-bg-surface)] text-[var(--hp-text-primary)]"
        >
          <option value="all">Todas las categorías</option>
          {Object.entries(CATEGORY_LABELS_FULL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* Solo vencidas */}
        <label className="flex items-center gap-2 text-sm text-[var(--hp-text-secondary)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyOverdue}
            onChange={(e) => setOverdue(e.target.checked)}
            className="rounded"
          />
          Solo vencidas / en riesgo
        </label>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-[var(--hp-text-secondary)]">{selected.size} seleccionadas</span>
            <Button
              variant="destructive"
              size="sm"
              disabled={bulkBusy}
              onClick={bulkClose}
            >
              {bulkBusy ? 'Cerrando…' : `Cerrar ${selected.size}`}
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-[var(--hp-text-muted)] hover:text-[var(--hp-text-primary)] underline"
            >
              Deseleccionar
            </button>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[var(--hp-text-muted)] text-sm">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-[var(--hp-text-muted)] text-sm">
            No hay solicitudes con estos filtros.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--hp-bg-page)] border-b border-[var(--hp-border)]">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === openItems.length && openItems.length > 0}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-[var(--hp-text-secondary)]">Solicitante</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--hp-text-secondary)]">Categoría</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--hp-text-secondary)]">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--hp-text-secondary)]">SLA</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--hp-text-secondary)]">Fecha</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hp-border-subtle)]">
              {items.map((item) => {
                const chip = getSlaChip(item.sla, item.status);
                const isSelectable = item.status !== 'closed';

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-[var(--hp-bg-page)] transition-colors"
                  >
                    <td className="px-4 py-3">
                      {isSelectable && (
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--hp-text-primary)] truncate max-w-[180px]">
                        {item.name ?? '—'}
                      </p>
                      <p className="text-xs text-[var(--hp-text-muted)] truncate max-w-[180px]">
                        {item.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--hp-bg-page)] border border-[var(--hp-border)] text-[var(--hp-text-secondary)]">
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status]}`}>
                        {STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${chip.className}`}>
                        {chip.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--hp-text-muted)]">
                      {new Date(item.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDrawer(item)}
                        className="text-xs text-brand-600 hover:underline border border-[var(--hp-border)] rounded-lg px-3 py-1 hover:border-brand-300 transition-colors"
                      >
                        Gestionar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer */}
      {drawer && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setDrawer(null)}
          />

          {/* Panel lateral */}
          <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-[var(--hp-bg-surface)] shadow-2xl z-50 flex flex-col overflow-hidden">

            {/* Header drawer */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--hp-border)]">
              <div>
                <h2 className="font-bold text-[var(--hp-text-primary)]">
                  {drawer.name ?? drawer.email}
                </h2>
                <p className="text-xs text-[var(--hp-text-muted)] mt-0.5">
                  {CATEGORY_LABELS_FULL[drawer.category] ?? drawer.category} ·{' '}
                  {new Date(drawer.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <button
                onClick={() => setDrawer(null)}
                className="text-[var(--hp-text-muted)] hover:text-[var(--hp-text-primary)] text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Cuerpo drawer */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Badges estado + SLA */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[drawer.status]}`}>
                  {STATUS_LABELS[drawer.status]}
                </span>
                {(() => {
                  const chip = getSlaChip(drawer.sla, drawer.status);
                  return (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${chip.className}`}>
                      {chip.label}
                    </span>
                  );
                })()}
                {drawer.sla.level && drawer.status !== 'closed' && (
                  <span className="text-xs text-[var(--hp-text-muted)]">
                    Límite: {drawer.sla.limit} días hábiles
                  </span>
                )}
              </div>

              {/* Contacto */}
              <div className="bg-[var(--hp-bg-page)] rounded-xl p-4 space-y-1.5">
                <p className="text-xs font-medium text-[var(--hp-text-muted)] uppercase tracking-wide">Contacto</p>
                <p className="text-sm text-[var(--hp-text-primary)]">{drawer.name ?? '—'}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-[var(--hp-text-secondary)]">{drawer.email}</p>
                  <a
                    href={`mailto:${drawer.email}?subject=Re: tu solicitud en HabitaPlan`}
                    className="text-xs text-brand-600 hover:underline border border-[var(--hp-border)] rounded-lg px-2 py-0.5 hover:border-brand-300 transition-colors"
                  >
                    ✉️ Responder
                  </a>
                </div>
                {drawer.dataRightType && (
                  <p className="text-xs text-[var(--hp-text-muted)]">Tipo derecho: {drawer.dataRightType}</p>
                )}
              </div>

              {/* Mensaje */}
              <div>
                <p className="text-xs font-medium text-[var(--hp-text-muted)] uppercase tracking-wide mb-2">Mensaje</p>
                <p className="text-sm text-[var(--hp-text-primary)] bg-[var(--hp-bg-page)] rounded-xl p-4 whitespace-pre-wrap leading-relaxed">
                  {drawer.message}
                </p>
              </div>

              {/* Respuesta anterior */}
              {drawer.firstRespondedAt && (
                <div className="bg-[var(--hp-bg-page)] rounded-xl p-4 space-y-1">
                  <p className="text-xs font-medium text-[var(--hp-text-muted)] uppercase tracking-wide">Primera respuesta</p>
                  <p className="text-sm text-[var(--hp-text-secondary)]">
                    {new Date(drawer.firstRespondedAt).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                    {drawer.responseChannel && (
                      <> · {CHANNEL_LABELS[drawer.responseChannel as ResponseChannel] ?? drawer.responseChannel}</>
                    )}
                  </p>
                </div>
              )}

              {/* Acciones — solo si no está cerrada */}
              {drawer.status !== 'closed' && (
                <div className="space-y-4 pt-2">
                  <div className="border-t border-[var(--hp-border)] pt-4">
                    <p className="text-xs font-medium text-[var(--hp-text-muted)] uppercase tracking-wide mb-3">
                      Canal de respuesta
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {RESPONSE_CHANNELS.map((ch) => (
                        <button
                          key={ch}
                          disabled={busy === drawer.id || drawer.responseChannel === ch}
                          onClick={() => patch(drawer.id, {
                            responseChannel: ch,
                            status: drawer.status === 'received' ? 'in_progress' : drawer.status,
                          })}
                          className={`text-sm py-2 px-3 rounded-xl border transition-colors text-left ${
                            drawer.responseChannel === ch
                              ? 'border-brand-400 bg-brand-50 text-brand-600 font-medium'
                              : 'border-[var(--hp-border)] text-[var(--hp-text-secondary)] hover:border-brand-300 hover:text-brand-600'
                          } disabled:opacity-40`}
                        >
                          {CHANNEL_LABELS[ch]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Estado */}
                  <div className="flex gap-2">
                    {drawer.status === 'received' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy === drawer.id}
                        onClick={() => patch(drawer.id, { status: 'in_progress' })}
                      >
                        {busy === drawer.id ? '…' : 'Marcar en proceso'}
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy === drawer.id}
                      onClick={() => patch(drawer.id, { status: 'closed' })}
                    >
                      {busy === drawer.id ? '…' : 'Cerrar PQRS'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Cerrada info */}
              {drawer.status === 'closed' && drawer.resolvedAt && (
                <div className="bg-[var(--hp-bg-subtle)] rounded-xl p-4">
                  <p className="text-sm text-[var(--hp-text-muted)]">
                    Cerrada el {new Date(drawer.resolvedAt).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                    {drawer.responseChannel && (
                      <> · Canal: {CHANNEL_LABELS[drawer.responseChannel as ResponseChannel] ?? drawer.responseChannel}</>
                    )}
                  </p>
                </div>
              )}

            </div>

            {/* SLA reference footer */}
            <div className="px-6 py-3 border-t border-[var(--hp-border)] bg-[var(--hp-bg-page)]">
              <p className="text-xs text-[var(--hp-text-muted)]">
                {(() => {
                  const sla = PQRS_SLA[drawer.category as keyof typeof PQRS_SLA] ?? PQRS_SLA.general;
                  return `SLA: ${sla.alertAt}d alerta · ${sla.limit}d límite · ${drawer.sla.businessDays}d transcurridos`;
                })()}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
