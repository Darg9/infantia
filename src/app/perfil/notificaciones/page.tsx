'use client';

import { useState, useEffect } from 'react'
import { PushButton } from '@/components/PushButton'
import { useToast } from '@/components/ui/toast'

interface NotificationPrefs {
  email: boolean
  push: boolean
  frequency: 'daily' | 'weekly' | 'none'
  categories: {
    newActivities: boolean
    favoritesUpdates: boolean
    providerAnnouncements: boolean
  }
}

const DEFAULT_PREFS: NotificationPrefs = {
  email: true,
  push: true,
  frequency: 'daily',
  categories: {
    newActivities: true,
    favoritesUpdates: true,
    providerAnnouncements: false,
  },
}

// ─── Toggle switch — diseño iOS-style ───────────────────────────────────────
function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        disabled
          ? 'cursor-not-allowed bg-[var(--hp-control-track)]'
          : checked
          ? 'bg-brand-500 cursor-pointer'
          : 'bg-[var(--hp-control-track)] cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default function NotificacionesPage() {
  const { toast } = useToast()
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/profile/notifications')
      .then((r) => r.json())
      .then((data) => {
        if (data.prefs) setPrefs(data.prefs)
      })
      .finally(() => setLoading(false))
  }, [])

  async function save(updated: NotificationPrefs) {
    setPrefs(updated)
    setSaving(true)

    try {
      const res = await fetch('/api/profile/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })

      if (res.ok) {
        toast.success('Preferencias guardadas')
      } else {
        const data = await res.json()
        toast.error(data.error ?? 'Error al guardar')
        // Revertir en caso de error
        setPrefs(prefs)
      }
    } catch {
      toast.error('Error de conexión')
      setPrefs(prefs)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--hp-text-primary)] mb-6">Notificaciones</h1>
        <div className="animate-pulse space-y-4">
          <div className='h-16 bg-[var(--hp-bg-page)] rounded-2xl' />
          <div className='h-16 bg-[var(--hp-bg-page)] rounded-2xl' />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-[var(--hp-text-primary)]">Notificaciones</h1>
        {saving && (
          <span className="text-xs text-[var(--hp-text-muted)] animate-pulse">Guardando…</span>
        )}
      </div>
      <p className="text-sm text-[var(--hp-text-secondary)] mb-6">
        Configura cómo y cuándo quieres recibir notificaciones.
      </p>

      {/* ── Canales ───────────────────────────────────────────────── */}
      <section className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-[var(--hp-text-primary)] mb-4">Canales</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--hp-text-primary)]">Email</p>
              <p className="text-xs text-[var(--hp-text-muted)]">Recibir notificaciones por correo electrónico</p>
            </div>
            <Toggle
              checked={prefs.email}
              onChange={(v) => save({ ...prefs, email: v })}
              label={prefs.email ? 'Desactivar email' : 'Activar email'}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--hp-text-primary)]">Push</p>
              <p className="text-xs text-[var(--hp-text-muted)]">Notificaciones en el navegador</p>
            </div>
            <PushButton />
          </div>
        </div>
      </section>

      {/* ── Frecuencia ────────────────────────────────────────────── */}
      <section className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-[var(--hp-text-primary)] mb-4">Frecuencia</h2>
        <div className="space-y-2">
          {[
            { value: 'daily' as const,  label: 'Diaria',   desc: 'Un resumen cada día' },
            { value: 'weekly' as const, label: 'Semanal',  desc: 'Un resumen cada semana' },
            { value: 'none' as const,   label: 'Ninguna',  desc: 'No enviar resumen' },
          ].map((opt) => {
            const active = prefs.frequency === opt.value
            return (
              <label
                key={opt.value}
                className={[
                  'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors',
                  active
                    ? 'bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800'
                    : 'border border-transparent hover:bg-[var(--hp-bg-page)]',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="frequency"
                  value={opt.value}
                  checked={active}
                  onChange={() => save({ ...prefs, frequency: opt.value })}
                  className="h-4 w-4 accent-brand-500 [color-scheme:light] dark:[color-scheme:dark]"
                />
                <div>
                  <p className="text-sm font-medium text-[var(--hp-text-primary)]">{opt.label}</p>
                  <p className="text-xs text-[var(--hp-text-muted)]">{opt.desc}</p>
                </div>
              </label>
            )
          })}
        </div>
      </section>

      {/* ── Categorías ────────────────────────────────────────────── */}
      <section className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-[var(--hp-text-primary)] mb-4">Categorías</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--hp-text-primary)]">Nuevas actividades</p>
              <p className="text-xs text-[var(--hp-text-secondary)]">Resumen de actividades agregadas recientemente</p>
            </div>
            <Toggle
              checked={prefs.categories.newActivities}
              onChange={(v) => save({ ...prefs, categories: { ...prefs.categories, newActivities: v } })}
              label={prefs.categories.newActivities ? 'Desactivar nuevas actividades' : 'Activar nuevas actividades'}
            />
          </div>

          <div className="flex items-center justify-between opacity-50">
            <div>
              <p className="text-sm font-medium text-[var(--hp-text-muted)]">Actualizaciones de favoritos</p>
              <p className="text-xs text-[var(--hp-text-muted)]">Cambios en tus actividades guardadas</p>
            </div>
            <Toggle checked={false} onChange={() => {}} disabled label="Próximamente" />
          </div>

          <div className="flex items-center justify-between opacity-50">
            <div>
              <p className="text-sm font-medium text-[var(--hp-text-muted)]">Anuncios de proveedores</p>
              <p className="text-xs text-[var(--hp-text-muted)]">Noticias de organizadores</p>
            </div>
            <Toggle checked={false} onChange={() => {}} disabled label="Próximamente" />
          </div>
        </div>
      </section>
    </div>
  )
}
