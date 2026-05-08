'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { RESPONSE_CHANNELS, PQRS_SLA, type ResponseChannel } from '@/lib/pqrs';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type PqrsStatus = 'received' | 'in_progress' | 'closed';

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
}

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<PqrsStatus, string> = {
  received:    'Recibida',
  in_progress: 'En proceso',
  closed:      'Cerrada',
};

const STATUS_COLORS: Record<PqrsStatus, string> = {
  received:    'bg-warning-100 text-warning-700',
  in_progress: 'bg-info-100 text-info-700',
  closed:      'bg-[var(--hp-bg-page)] text-[var(--hp-text-muted)]',
};

const CATEGORY_LABELS: Record<string, string> = {
  general:          'General',
  content_removal:  'Eliminación de contenido',
  data_access:      'Acceso a datos',
  data_claim:       'Corrección de datos',
  report_error:     'Reportar error',
  other:            'Otro',
};

const CHANNEL_LABELS: Record<ResponseChannel, string> = {
  email:    'Correo',
  phone:    'Teléfono',
  whatsapp: 'WhatsApp',
  manual:   'Manual',
  platform: 'Plataforma',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBusinessDays(start: string, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  while (cur <= e) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(0, count - 1);
}

function getSlaLabel(item: Pqrs, now: Date): { text: string; color: string } | null {
  if (item.status === 'closed') return null;
  const sla = PQRS_SLA[item.category as keyof typeof PQRS_SLA] ?? PQRS_SLA.general;
  const days = getBusinessDays(item.createdAt, now);
  if (days > sla.limit)     return { text: `🚨 Vencida (${days}d)`,      color: 'text-error-600 font-semibold' };
  if (days === sla.limit)   return { text: `⏱️ Vence hoy (${days}d)`,    color: 'text-warning-600 font-semibold' };
  if (days >= sla.alertAt)  return { text: `⚠️ En riesgo (${days}/${sla.limit}d)`, color: 'text-warning-500' };
  return { text: `✅ Ok (${days}/${sla.limit}d)`, color: 'text-[var(--hp-text-muted)]' };
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function PqrsAdminPage() {
  const [items, setItems]         = useState<Pqrs[]>([]);
  const [filter, setFilter]       = useState<PqrsStatus | 'all'>('received');
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [busy, setBusy]           = useState<string | null>(null);
  const [msg, setMsg]             = useState('');
  const [tick, setTick]           = useState(0); // incrementar para forzar recarga
  const now = new Date();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/pqrs?status=${filter}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: Pqrs[] | null) => { if (!cancelled && data) setItems(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [filter, tick]);

  async function patch(id: string, data: {
    status?: PqrsStatus;
    responseChannel?: ResponseChannel;
    firstRespondedAt?: string;
  }) {
    setBusy(id);
    setMsg('');
    const res = await fetch(`/api/admin/pqrs/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    if (res.ok) {
      setMsg('✅ Actualizado correctamente.');
      setTick(t => t + 1); // dispara re-fetch via useEffect
      setExpanded(null);
    } else {
      const err = await res.json().catch(() => ({}));
      setMsg(`❌ Error: ${err.error ?? 'desconocido'}`);
    }
    setBusy(null);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--hp-text-primary)]">PQRS</h1>
          <p className="text-sm text-[var(--hp-text-secondary)] mt-1">
            Gestión de solicitudes de contacto (Ley 1581 / SIC)
          </p>
        </div>
        <a href="/admin" className="text-sm text-brand-600 hover:underline">← Admin</a>
      </div>

      {/* Filtros de estado */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['all', 'received', 'in_progress', 'closed'] as const).map((s) => (
          <Button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs font-medium px-4 py-1.5 rounded-full border transition-colors ${
              filter === s
                ? 'bg-brand-600 text-white border-brand-600'
                : 'border-[var(--hp-border)] text-[var(--hp-text-secondary)] hover:border-brand-300'
            }`}
          >
            {s === 'all' ? 'Todas' : STATUS_LABELS[s]}
          </Button>
        ))}
      </div>

      {/* Feedback */}
      {msg && (
        <p className="text-sm mb-4 px-3 py-2 bg-[var(--hp-bg-page)] border border-[var(--hp-border)] rounded-lg text-[var(--hp-text-primary)]">
          {msg}
        </p>
      )}

      {/* Lista */}
      {items.length === 0 ? (
        <p className="text-center text-[var(--hp-text-muted)] py-12">
          No hay solicitudes{filter !== 'all' ? ` ${STATUS_LABELS[filter as PqrsStatus].toLowerCase()}s` : ''}.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const sla     = getSlaLabel(item, now);
            const isOpen  = expanded === item.id;

            return (
              <div
                key={item.id}
                className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl p-5"
              >
                {/* Fila principal */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-[var(--hp-text-primary)] text-sm">
                        {item.name ?? item.email}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[item.status]}`}>
                        {STATUS_LABELS[item.status]}
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-xs bg-[var(--hp-bg-page)] text-[var(--hp-text-secondary)] border border-[var(--hp-border)]">
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </span>
                      {sla && <span className={`text-xs ${sla.color}`}>{sla.text}</span>}
                    </div>

                    <p className="text-xs text-[var(--hp-text-muted)] mb-1">
                      {item.email} · {new Date(item.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    <p className="text-sm text-[var(--hp-text-secondary)] line-clamp-2">{item.message}</p>

                    {item.responseChannel && (
                      <p className="text-xs text-[var(--hp-text-muted)] mt-1">
                        Respondido vía {CHANNEL_LABELS[item.responseChannel as ResponseChannel] ?? item.responseChannel}
                        {item.firstRespondedAt && ` · ${new Date(item.firstRespondedAt).toLocaleDateString('es-CO')}`}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-shrink-0 items-start">
                    <button
                      onClick={() => setExpanded(isOpen ? null : item.id)}
                      className="text-xs text-brand-600 hover:underline border border-[var(--hp-border)] rounded-lg px-3 py-1.5"
                    >
                      {isOpen ? 'Cerrar' : 'Gestionar'}
                    </button>
                  </div>
                </div>

                {/* Panel expandido */}
                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-[var(--hp-border)] space-y-4">
                    {/* Mensaje completo */}
                    <div>
                      <p className="text-xs font-medium text-[var(--hp-text-muted)] mb-1">Mensaje completo</p>
                      <p className="text-sm text-[var(--hp-text-primary)] bg-[var(--hp-bg-page)] rounded-lg p-3 whitespace-pre-wrap">
                        {item.message}
                      </p>
                      {item.dataRightType && (
                        <p className="text-xs text-[var(--hp-text-muted)] mt-1">Tipo derecho: {item.dataRightType}</p>
                      )}
                    </div>

                    {/* Acciones de estado */}
                    {item.status !== 'closed' && (
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-[var(--hp-text-muted)]">Actualizar estado</p>

                        {/* Canal de respuesta */}
                        {!item.firstRespondedAt && (
                          <div>
                            <p className="text-xs text-[var(--hp-text-muted)] mb-2">Marcar primera respuesta</p>
                            <div className="flex gap-2 flex-wrap">
                              {RESPONSE_CHANNELS.map((ch) => (
                                <button
                                  key={ch}
                                  disabled={busy === item.id}
                                  onClick={() => patch(item.id, {
                                    responseChannel: ch,
                                    status: item.status === 'received' ? 'in_progress' : item.status,
                                  })}
                                  className="text-xs border border-[var(--hp-border)] rounded-lg px-3 py-1.5 hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-40"
                                >
                                  {CHANNEL_LABELS[ch]}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Cambio de estado */}
                        <div className="flex gap-2 flex-wrap">
                          {item.status === 'received' && (
                            <Button
                              size="sm"
                              disabled={busy === item.id}
                              onClick={() => patch(item.id, { status: 'in_progress' })}
                            >
                              {busy === item.id ? '…' : 'Marcar en proceso'}
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={busy === item.id}
                            onClick={() => patch(item.id, { status: 'closed' })}
                          >
                            {busy === item.id ? '…' : 'Cerrar PQRS'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Info de resolución */}
                    {item.status === 'closed' && (
                      <p className="text-xs text-[var(--hp-text-muted)]">
                        Cerrada el {item.resolvedAt
                          ? new Date(item.resolvedAt).toLocaleDateString('es-CO')
                          : '—'}
                        {item.responseChannel && ` · Canal: ${CHANNEL_LABELS[item.responseChannel as ResponseChannel] ?? item.responseChannel}`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
