'use client';

/**
 * Panel PQRS — Admin (Variante B: tabla + drawer lateral)
 *
 * Backend:  GET/PATCH /api/admin/pqrs  ·  GET/PATCH /api/admin/pqrs/:id
 * SSOT:     src/lib/pqrs.ts — CONTACT_CATEGORIES / RESPONSE_CHANNELS / PQRS_SLA
 * DS:       ToggleChip (filtros + canales)  ·  Button  ·  useToast
 * A11y:     Drawer = role="dialog" + aria-modal + focus-trap + Escape
 */

import { useEffect, useState, useCallback, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { Button, useToast, ToggleChip } from '@/components/ui';
import { RESPONSE_CHANNELS, PQRS_SLA, type ResponseChannel } from '@/lib/pqrs';

// ── Tipos ──────────────────────────────────────────────────────────────────────

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

// ── Etiquetas ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<PqrsStatus, string> = {
  received:    'Recibida',
  in_progress: 'En proceso',
  closed:      'Cerrada',
};

// Estado de status badge — usa tokens definidos en globals.css
const STATUS_CHIP: Record<PqrsStatus, string> = {
  received:    'bg-warning-500/10 text-warning-600',
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

// ── SLA chip ───────────────────────────────────────────────────────────────────

function getSlaChip(sla: SlaInfo, status: PqrsStatus) {
  if (status === 'closed') {
    return { label: 'Cerrada', className: 'bg-[var(--hp-bg-subtle)] text-[var(--hp-text-muted)]' };
  }
  if (!sla.level) {
    return { label: `✅ Ok ${sla.businessDays}/${sla.limit}d`, className: 'bg-success-500/10 text-success-600' };
  }
  if (sla.level === 'WARNING') {
    return { label: `⚠️ Riesgo ${sla.businessDays}/${sla.limit}d`, className: 'bg-warning-500/15 text-warning-600' };
  }
  if (sla.level === 'DUE_TODAY') {
    return { label: `⏱️ Vence hoy ${sla.businessDays}d`, className: 'bg-warning-500/25 text-warning-600 font-semibold' };
  }
  // OVERDUE
  return { label: `🚨 Vencida ${sla.businessDays}d`, className: 'bg-error-500/10 text-error-600 font-semibold' };
}

// ── Focus trap (drawer) ────────────────────────────────────────────────────────

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(container: HTMLElement, e: KeyboardEvent) {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (!nodes.length) return;
  const first = nodes[0];
  const last  = nodes[nodes.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

// ── Drawer ─────────────────────────────────────────────────────────────────────

interface DrawerProps {
  item:    Pqrs;
  busy:    string | null;
  onClose: () => void;
  onPatch: (id: string, data: { status?: PqrsStatus; responseChannel?: ResponseChannel }) => Promise<void>;
}

function PqrsDrawer({ item, busy, onClose, onPatch }: DrawerProps) {
  const panelRef  = useRef<HTMLDivElement>(null);
  const titleId   = useId();
  const isBusy    = busy === item.id;
  const chip      = getSlaChip(item.sla, item.status);

  // Focus primer elemento al abrir
  useEffect(() => {
    const el = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    el?.focus();
  }, []);

  // Bloquear scroll del body
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && panelRef.current) trapFocus(panelRef.current, e);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const slaRef = PQRS_SLA[item.category as keyof typeof PQRS_SLA] ?? PQRS_SLA.general;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel lateral */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-y-0 right-0 w-full max-w-lg bg-[var(--hp-bg-surface)] shadow-2xl z-50 flex flex-col overflow-hidden"
        onKeyDown={(e) => {
          if (e.key === 'Tab' && panelRef.current) trapFocus(panelRef.current, e.nativeEvent);
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-[var(--hp-border)] flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h2 id={titleId} className="font-bold text-[var(--hp-text-primary)] truncate">
              {item.name ?? item.email}
            </h2>
            <p className="text-xs text-[var(--hp-text-muted)] mt-0.5 truncate">
              {CATEGORY_LABELS_FULL[item.category] ?? item.category} ·{' '}
              {new Date(item.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cerrar"
            onClick={onClose}
            className="w-8 h-8 p-1.5 shrink-0 flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </Button>
        </div>

        {/* Cuerpo scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Badges estado + SLA */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CHIP[item.status]}`}>
              {STATUS_LABELS[item.status]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${chip.className}`}>
              {chip.label}
            </span>
            {item.sla.level && item.status !== 'closed' && (
              <span className="text-xs text-[var(--hp-text-muted)]">
                Límite: {item.sla.limit} días hábiles
              </span>
            )}
          </div>

          {/* Contacto */}
          <div className="bg-[var(--hp-bg-page)] rounded-xl p-4 space-y-1.5">
            <p className="text-xs font-medium text-[var(--hp-text-muted)] uppercase tracking-wide">Contacto</p>
            <p className="text-sm text-[var(--hp-text-primary)]">{item.name ?? '—'}</p>
            <div className="flex items-center gap-2">
              <p className="text-sm text-[var(--hp-text-secondary)] truncate">{item.email}</p>
              <a
                href={`mailto:${item.email}?subject=Re: tu solicitud en HabitaPlan`}
                className="shrink-0 text-xs text-hp-action-primary hover:underline border border-[var(--hp-border)] rounded-lg px-2 py-0.5 hover:border-brand-300 transition-colors"
              >
                ✉️ Responder
              </a>
            </div>
            {item.dataRightType && (
              <p className="text-xs text-[var(--hp-text-muted)]">Tipo derecho: {item.dataRightType}</p>
            )}
          </div>

          {/* Mensaje */}
          <div>
            <p className="text-xs font-medium text-[var(--hp-text-muted)] uppercase tracking-wide mb-2">Mensaje</p>
            <p className="text-sm text-[var(--hp-text-primary)] bg-[var(--hp-bg-page)] rounded-xl p-4 whitespace-pre-wrap leading-relaxed">
              {item.message}
            </p>
          </div>

          {/* Primera respuesta (si ya fue respondida) */}
          {item.firstRespondedAt && (
            <div className="bg-[var(--hp-bg-page)] rounded-xl p-4 space-y-1">
              <p className="text-xs font-medium text-[var(--hp-text-muted)] uppercase tracking-wide">Primera respuesta</p>
              <p className="text-sm text-[var(--hp-text-secondary)]">
                {new Date(item.firstRespondedAt).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                {item.responseChannel && (
                  <> · {CHANNEL_LABELS[item.responseChannel as ResponseChannel] ?? item.responseChannel}</>
                )}
              </p>
            </div>
          )}

          {/* Acciones (solo si no está cerrada) */}
          {item.status !== 'closed' && (
            <div className="space-y-4 pt-2">

              {/* Canal de respuesta */}
              <div className="border-t border-[var(--hp-border)] pt-4">
                <p className="text-xs font-medium text-[var(--hp-text-muted)] uppercase tracking-wide mb-3">
                  Canal de respuesta
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {RESPONSE_CHANNELS.map((ch) => (
                    <ToggleChip
                      key={ch}
                      variant="tile"
                      pressed={item.responseChannel === ch}
                      disabled={isBusy || item.responseChannel === ch}
                      onClick={() => onPatch(item.id, {
                        responseChannel: ch,
                        status: item.status === 'received' ? 'in_progress' : item.status,
                      })}
                    >
                      {CHANNEL_LABELS[ch]}
                    </ToggleChip>
                  ))}
                </div>
              </div>

              {/* Cambio de estado */}
              <div className="flex gap-2">
                {item.status === 'received' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={isBusy}
                    onClick={() => onPatch(item.id, { status: 'in_progress' })}
                  >
                    Marcar en proceso
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  loading={isBusy}
                  onClick={() => onPatch(item.id, { status: 'closed' })}
                >
                  Cerrar PQRS
                </Button>
              </div>
            </div>
          )}

          {/* Info de cierre */}
          {item.status === 'closed' && item.resolvedAt && (
            <div className="bg-[var(--hp-bg-subtle)] rounded-xl p-4">
              <p className="text-sm text-[var(--hp-text-muted)]">
                Cerrada el {new Date(item.resolvedAt).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                {item.responseChannel && (
                  <> · Canal: {CHANNEL_LABELS[item.responseChannel as ResponseChannel] ?? item.responseChannel}</>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Footer SLA */}
        <div className="px-6 py-3 border-t border-[var(--hp-border)] bg-[var(--hp-bg-page)] flex-shrink-0">
          <p className="text-xs text-[var(--hp-text-muted)]">
            SLA: {slaRef.alertAt}d alerta · {slaRef.limit}d límite · {item.sla.businessDays}d transcurridos
          </p>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

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

  // ── Fetch ────────────────────────────────────────────────────────────────────

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
  // tick fuerza refetch manual sin ser una dep semántica
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter, onlyOverdue, tick]);

  useEffect(() => { load(); }, [load]);

  // ── PATCH individual ──────────────────────────────────────────────────────────

  const patch = useCallback(async (id: string, data: {
    status?: PqrsStatus;
    responseChannel?: ResponseChannel;
  }) => {
    setBusy(id);
    const res = await fetch(`/api/admin/pqrs/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    if (res.ok) {
      toast.success('Actualizado');
      setDrawer(null);
      setTick(t => t + 1);
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? 'Error desconocido');
    }
    setBusy(null);
  }, [toast]);

  // ── Bulk close ────────────────────────────────────────────────────────────────

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

  // ── Selección ─────────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const open = items.filter(i => i.status !== 'closed');
    setSelected(selected.size === open.length ? new Set() : new Set(open.map(i => i.id)));
  }

  const openItems = items.filter(i => i.status !== 'closed');

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <a href="/admin" className="text-sm text-[var(--hp-text-muted)] hover:text-[var(--hp-text-primary)] transition-colors">
            ← Admin
          </a>
          <h1 className="text-2xl font-bold text-[var(--hp-text-primary)] mt-1">PQRS</h1>
          <p className="text-sm text-[var(--hp-text-secondary)]">
            {total} solicitudes · Ley 1581 / SIC
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">

        {/* Status — ToggleChip pill */}
        <div className="flex gap-1.5">
          {(['all', 'received', 'in_progress', 'closed'] as const).map((s) => (
            <ToggleChip
              key={s}
              variant="pill"
              pressed={statusFilter === s}
              onClick={() => { setStatus(s); setSelected(new Set()); }}
            >
              {s === 'all' ? 'Todas' : STATUS_LABELS[s]}
            </ToggleChip>
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
              loading={bulkBusy}
              onClick={bulkClose}
            >
              Cerrar {selected.size}
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
                    aria-label="Seleccionar todas"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-[var(--hp-text-secondary)]">Solicitante</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--hp-text-secondary)]">Categoría</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--hp-text-secondary)]">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--hp-text-secondary)]">SLA</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--hp-text-secondary)]">Fecha</th>
                <th className="px-4 py-3 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hp-border-subtle)]">
              {items.map((item) => {
                const chip = getSlaChip(item.sla, item.status);
                const isSelectable = item.status !== 'closed';

                return (
                  <tr key={item.id} className="hover:bg-[var(--hp-bg-page)] transition-colors">
                    <td className="px-4 py-3">
                      {isSelectable && (
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded"
                          aria-label={`Seleccionar PQRS de ${item.name ?? item.email}`}
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
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CHIP[item.status]}`}>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDrawer(item)}
                      >
                        Gestionar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer lateral */}
      {drawer && (
        <PqrsDrawer
          item={drawer}
          busy={busy}
          onClose={() => setDrawer(null)}
          onPatch={patch}
        />
      )}
    </div>
  );
}
