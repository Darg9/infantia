'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Input, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/toast';

interface Sponsor {
  id: string;
  name: string;
  tagline: string;
  logoUrl: string | null;
  url: string;
  isActive: boolean;
  campaignStart: string | null;
  campaignEnd: string | null;
}

const EMPTY: Omit<Sponsor, 'id'> = {
  name: '', tagline: '', logoUrl: '', url: '',
  isActive: false, campaignStart: '', campaignEnd: '',
};

export default function SponsorsAdminPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // ── Modal de confirmación de borrado ──────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Sponsor | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  async function load() {
    const res = await fetch('/api/admin/sponsors');
    if (res.ok) setSponsors(await res.json());
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial one-shot en mount
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    const url = editId ? `/api/admin/sponsors/${editId}` : '/api/admin/sponsors';
    const method = editId ? 'PATCH' : 'POST';
    const body = {
      ...form,
      logoUrl: form.logoUrl || null,
      campaignStart: form.campaignStart || null,
      campaignEnd: form.campaignEnd || null,
    };
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      toast.success(editId ? 'Patrocinador actualizado.' : 'Patrocinador creado.');
      setForm(EMPTY);
      setEditId(null);
      load();
    } else {
      toast.error('Error al guardar.');
    }
    setSaving(false);
  }

  async function toggleActive(s: Sponsor) {
    await fetch(`/api/admin/sponsors/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/sponsors/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteTarget(null);
    if (res.ok) {
      toast.success('Patrocinador eliminado.');
      load();
    } else {
      toast.error('Error al eliminar.');
    }
  }

  function edit(s: Sponsor) {
    setEditId(s.id);
    setForm({
      name: s.name, tagline: s.tagline, logoUrl: s.logoUrl ?? '',
      url: s.url, isActive: s.isActive,
      campaignStart: s.campaignStart ? s.campaignStart.slice(0, 10) : '',
      campaignEnd: s.campaignEnd ? s.campaignEnd.slice(0, 10) : '',
    });
  }

  const field = (k: keyof typeof form, label: string, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-[var(--hp-text-primary)] mb-1">{label}</label>
      <input
        type={type}
        className="w-full border border-[var(--hp-border-subtle)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        value={form[k] as string}
        onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--hp-text-primary)]">Patrocinadores</h1>
          <p className="text-sm text-[var(--hp-text-secondary)] mt-1">Gestiona sponsors para el newsletter</p>
        </div>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">← Admin</Link>
      </div>

      {/* Formulario */}
      <div className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl p-6 mb-8">
        <h2 className="font-semibold text-[var(--hp-text-primary)] mb-4">
          {editId ? 'Editar patrocinador' : 'Nuevo patrocinador'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('name', 'Nombre')}
          {field('url', 'URL del sitio (con https://)', 'url')}
          <div className="sm:col-span-2">{field('tagline', 'Tagline (frase corta)')}</div>
          {field('logoUrl', 'URL del logo (opcional)', 'url')}
          {field('campaignStart', 'Inicio campaña', 'date')}
          {field('campaignEnd', 'Fin campaña', 'date')}
          <div className="flex items-center gap-2">
            <Input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="rounded accent-brand-500"
            />
            <label htmlFor="isActive" className="text-sm text-[var(--hp-text-primary)]">
              Activo (aparece en emails)
            </label>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <Button
            variant="primary"
            size="sm"
            onClick={save}
            loading={saving}
            disabled={saving || !form.name || !form.tagline || !form.url}
          >
            {editId ? 'Actualizar' : 'Crear'}
          </Button>
          {editId && (
            <Button variant="ghost" size="sm" onClick={() => { setEditId(null); setForm(EMPTY); }}>
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Lista */}
      {sponsors.length === 0 ? (
        <p className="text-center text-[var(--hp-text-muted)] py-12">No hay patrocinadores aún.</p>
      ) : (
        <div className="space-y-3">
          {sponsors.map(s => (
            <div key={s.id} className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl p-5 flex items-start gap-4">
              {s.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logoUrl} alt={s.name} className="h-10 w-10 object-contain rounded-lg border border-[var(--hp-border)] flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[var(--hp-text-primary)]">{s.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.isActive ? 'bg-success-100 text-success-700' : 'bg-[var(--hp-bg-page)] text-[var(--hp-text-secondary)]'}`}>
                    {s.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-sm text-[var(--hp-text-secondary)] mt-0.5 truncate">{s.tagline}</p>
                <p className="text-xs text-[var(--hp-text-muted)] mt-0.5">
                  {s.campaignStart?.slice(0, 10)} → {s.campaignEnd?.slice(0, 10) ?? 'Sin fin'}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => toggleActive(s)}>
                  {s.isActive ? 'Desactivar' : 'Activar'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => edit(s)}>
                  Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(s)}>
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal de confirmación de borrado ─────────────────────────────────── */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar patrocinador"
        description={deleteTarget ? `¿Seguro que quieres eliminar "${deleteTarget.name}"? Esta acción no se puede deshacer.` : ''}
        size="sm"
      >
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="destructive" size="sm" onClick={confirmDelete} loading={deleting}>
            Eliminar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
