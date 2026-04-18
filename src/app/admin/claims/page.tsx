'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';

type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface Claim {
  id:          string;
  userId:      string;
  userEmail:   string;
  userName:    string | null;
  message:     string | null;
  status:      ClaimStatus;
  createdAt:   string;
  provider: {
    id:   string;
    name: string;
    slug: string | null;
  };
}

const STATUS_LABELS: Record<ClaimStatus, string> = {
  PENDING:  'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

const STATUS_COLORS: Record<ClaimStatus, string> = {
  PENDING:  'bg-warning-100 text-warning-700',
  APPROVED: 'bg-success-100 text-success-700',
  REJECTED: 'bg-gray-100 text-[var(--hp-text-secondary)]',
};

export default function ClaimsAdminPage() {
  const [claims, setClaims]   = useState<Claim[]>([]);
  const [filter, setFilter]   = useState<ClaimStatus>('PENDING');
  const [busy, setBusy]       = useState<string | null>(null);
  const [msg, setMsg]         = useState('');

  async function load(status: ClaimStatus) {
    const res = await fetch(`/api/admin/claims?status=${status}`);
    if (res.ok) setClaims(await res.json());
  }

  useEffect(() => { load(filter); }, [filter]);

  async function act(id: string, action: 'approve' | 'reject') {
    setBusy(id);
    setMsg('');
    const res = await fetch(`/api/admin/claims/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action }),
    });
    if (res.ok) {
      setMsg(action === 'approve' ? '✅ Solicitud aprobada.' : '❌ Solicitud rechazada.');
      load(filter);
    } else {
      setMsg('Error al procesar la solicitud.');
    }
    setBusy(null);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--hp-text-primary)]">Solicitudes de perfil</h1>
          <p className="text-sm text-[var(--hp-text-secondary)] mt-1">Aprueba o rechaza reclamaciones de proveedores</p>
        </div>
        <a href="/admin" className="text-sm text-brand-600 hover:underline">← Admin</a>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        {(['PENDING', 'APPROVED', 'REJECTED'] as ClaimStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs font-medium px-4 py-1.5 rounded-full border transition-colors ${
              filter === s
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-[var(--hp-border)] text-[var(--hp-text-secondary)] hover:border-gray-400'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {msg && (
        <p className="text-sm mb-4 px-3 py-2 bg-[var(--hp-bg-page)] border border-[var(--hp-border)] rounded-lg text-[var(--hp-text-primary)]">{msg}</p>
      )}

      {claims.length === 0 ? (
        <p className="text-center text-[var(--hp-text-muted)] py-12">No hay solicitudes {STATUS_LABELS[filter].toLowerCase()}s.</p>
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <div key={c.id} className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <a
                      href={`/proveedores/${c.provider.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--hp-text-primary)] hover:text-brand-600"
                    >
                      {c.provider.name}
                    </a>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{c.userName ?? '—'} · {c.userEmail}</p>
                  {c.message && (
                    <p className="text-sm text-[var(--hp-text-secondary)] mt-2 italic">"{c.message}"</p>
                  )}
                  <p className="text-xs text-[var(--hp-text-muted)] mt-2">
                    {new Date(c.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>

                {c.status === 'PENDING' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => act(c.id, 'approve')}
                      disabled={busy === c.id}
                    >
                      {busy === c.id ? '…' : 'Aprobar'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => act(c.id, 'reject')}
                      disabled={busy === c.id}
                    >
                      Rechazar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
