'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Button, useToast } from '@/components/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Source {
  id: string;
  name: string;
  platform: string;
  url: string;
  isActive: boolean;
  scheduleCron: string;
  scraperType: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunItems: number | null;
  notes: string | null;
  city: { id: string; name: string };
  vertical: { id: string; slug: string };
}

interface City {
  id: string;
  name: string;
}

interface Vertical {
  id: string;
  slug: string;
}

interface Props {
  cities: City[];
  verticals: Vertical[];
}

const PLATFORMS = ['WEBSITE', 'INSTAGRAM', 'FACEBOOK', 'TELEGRAM', 'TIKTOK', 'X', 'WHATSAPP'];

const EMPTY_FORM = {
  name: '',
  platform: 'WEBSITE',
  url: '',
  cityId: '',
  verticalId: '',
  scraperType: 'cheerio',
  scheduleCron: '0 6 * * *',
  isActive: true,
  notes: '',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SourcesManager({ cities, verticals }: Props) {
  const { toast } = useToast();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sources');
      if (!res.ok) throw new Error('Error al cargar fuentes');
      const data: Source[] = await res.json();
      setSources(data);
    } catch {
      toast.error('No se pudieron cargar las fuentes');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function toggle(id: string, current: boolean) {
    try {
      const res = await fetch(`/api/admin/sources/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !current }),
      });
      if (!res.ok) throw new Error();
      setSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isActive: !current } : s)),
      );
      toast.success(`Fuente ${!current ? 'activada' : 'pausada'}`);
    } catch {
      toast.error('Error al actualizar la fuente');
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`¿Eliminar la fuente "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/admin/sources/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setSources((prev) => prev.filter((s) => s.id !== id));
      toast.success(`Fuente "${name}" eliminada`);
    } catch {
      toast.error('Error al eliminar la fuente');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.cityId || !form.verticalId) {
      toast.error('Selecciona ciudad y vertical');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.formErrors?.[0] ?? 'Error al crear fuente');
      }
      const created: Source = await res.json();
      setSources((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast.success(`Fuente "${created.name}" creada`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al crear fuente');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Derived stats ──────────────────────────────────────────────────────────

  const activeCount = sources.filter((s) => s.isActive).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--hp-text-secondary)]">
          {sources.length} fuentes totales · {activeCount} activas
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Cancelar' : '+ Nueva fuente'}
        </Button>
      </div>
      {/* Add form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-[var(--hp-bg-page)] border border-[var(--hp-border)] rounded-2xl p-6 space-y-4"
        >
          <h3 className="font-semibold text-[var(--hp-text-primary)] mb-2">Nueva fuente de scraping</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Nombre</label>
              <Input
                type="text"
                required
                minLength={2}
                maxLength={255}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="BibloRed Bogotá"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* URL */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">URL</label>
              <Input
                type="url"
                required
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://ejemplo.com/actividades"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Platform */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Plataforma</label>
              <select
                value={form.platform}
                onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* ScraperType */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Tipo de scraper</label>
              <select
                value={form.scraperType}
                onChange={(e) => setForm((f) => ({ ...f, scraperType: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="cheerio">cheerio</option>
                <option value="playwright">playwright</option>
                <option value="telegram">telegram</option>
                <option value="sitemap">sitemap</option>
              </select>
            </div>

            {/* City */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Ciudad</label>
              <select
                required
                value={form.cityId}
                onChange={(e) => setForm((f) => ({ ...f, cityId: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Seleccionar ciudad…</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Vertical */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Vertical</label>
              <select
                required
                value={form.verticalId}
                onChange={(e) => setForm((f) => ({ ...f, verticalId: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Seleccionar vertical…</option>
                {verticals.map((v) => (
                  <option key={v.id} value={v.id}>{v.slug}</option>
                ))}
              </select>
            </div>

            {/* Schedule */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Cron (schedule)</label>
              <Input
                type="text"
                value={form.scheduleCron}
                onChange={(e) => setForm((f) => ({ ...f, scheduleCron: e.target.value }))}
                placeholder="0 6 * * *"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Notas (opcional)</label>
              <Input
                type="text"
                maxLength={1000}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Contexto o instrucciones especiales"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm text-[var(--hp-text-primary)] cursor-pointer">
              <Input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 accent-brand-500"
              />
              Activar inmediatamente
            </label>

            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={submitting}>
                {submitting ? 'Guardando…' : 'Crear fuente'}
              </Button>
            </div>
          </div>
        </form>
      )}
      {/* Table */}
      {loading ? (
        <div className="text-center py-8 text-[var(--hp-text-muted)] text-sm">Cargando fuentes…</div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 text-[var(--hp-text-muted)] text-sm">
          No hay fuentes registradas. Crea la primera con el botón de arriba.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--hp-bg-page)] border-b border-[var(--hp-border)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Fuente / URL</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Plataforma</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Ciudad</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Último run</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sources.map((source) => (
                <tr key={source.id} className="hover:bg-[var(--hp-bg-page)]">
                  {/* Name + URL */}
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium text-[var(--hp-text-primary)] truncate">{source.name}</p>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-600 hover:underline truncate block"
                    >
                      {source.url}
                    </a>
                  </td>

                  {/* Platform */}
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {source.platform}
                  </td>

                  {/* City */}
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {source.city?.name ?? '—'}
                  </td>

                  {/* Last run */}
                  <td className="px-4 py-3 text-[var(--hp-text-secondary)] whitespace-nowrap">
                    {source.lastRunAt ? (
                      <div>
                        <p>{new Date(source.lastRunAt).toLocaleDateString('es-CO')}</p>
                        {source.lastRunItems != null && (
                          <p className="text-xs text-[var(--hp-text-muted)]">{source.lastRunItems} items</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-[var(--hp-text-muted)]">Sin datos</span>
                    )}
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-3 text-center">
                    {source.isActive ? (
                      <span className="inline-block bg-success-100 text-success-700 px-2 py-1 rounded text-xs font-medium">
                        Activa
                      </span>
                    ) : (
                      <span className="inline-block bg-warning-100 text-warning-700 px-2 py-1 rounded text-xs font-medium">
                        Pausada
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggle(source.id, source.isActive)}
                      >
                        {source.isActive ? 'Pausar' : 'Activar'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => remove(source.id, source.name)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
