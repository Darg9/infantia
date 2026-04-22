'use client';
import { Button, Input } from '@/components/ui';

import { useState, useEffect } from 'react'
import { PushButton } from '@/components/PushButton'

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

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
        disabled
          ? 'bg-gray-200 cursor-not-allowed'
          : checked
          ? 'bg-brand-500 cursor-pointer'
          : 'bg-gray-300 cursor-pointer'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-[var(--hp-bg-surface)] shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </Button>
  );
}

export default function NotificacionesPage() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
    setMsg(null)

    try {
      const res = await fetch('/api/profile/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })

      if (res.ok) {
        setMsg({ type: 'success', text: 'Preferencias guardadas' })
      } else {
        const data = await res.json()
        setMsg({ type: 'error', text: data.error ?? 'Error al guardar' })
      }
    } catch {
      setMsg({ type: 'error', text: 'Error de conexion' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--hp-text-primary)] mb-6">Notificaciones</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-16 bg-gray-100 rounded-2xl" />
          <div className="h-16 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--hp-text-primary)] mb-2">Notificaciones</h1>
      <p className="text-sm text-[var(--hp-text-secondary)] mb-6">
        Configura como y cuando quieres recibir notificaciones.
      </p>
      {msg && (
        <div className={`text-sm px-3 py-2 rounded-lg mb-4 ${
          msg.type === 'success'
            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
            : 'text-error-600 bg-error-50 border border-error-200'
        }`}>
          {msg.text}
        </div>
      )}
      {/* Canales */}
      <section className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-[var(--hp-text-primary)] mb-4">Canales</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--hp-text-primary)]">Email</p>
              <p className="text-xs text-[var(--hp-text-muted)]">Recibir notificaciones por correo electronico</p>
            </div>
            <Toggle
              checked={prefs.email}
              onChange={(v) => save({ ...prefs, email: v })}
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
      {/* Frecuencia */}
      <section className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-[var(--hp-text-primary)] mb-4">Frecuencia</h2>
        <div className="space-y-2">
          {[
            { value: 'daily' as const, label: 'Diaria', desc: 'Un resumen cada dia' },
            { value: 'weekly' as const, label: 'Semanal', desc: 'Un resumen cada semana' },
            { value: 'none' as const, label: 'Ninguna', desc: 'No enviar resumen' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                prefs.frequency === opt.value
                  ? 'bg-brand-50 border border-brand-200'
                  : 'border border-transparent hover:bg-[var(--hp-bg-page)]'
              }`}
            >
              {/* eslint-disable-next-line no-restricted-syntax -- formulario interno, DS Input requiere id+label */}
              <input
                type="radio"
                name="frequency"
                value={opt.value}
                checked={prefs.frequency === opt.value}
                onChange={() => save({ ...prefs, frequency: opt.value })}
                className="h-4 w-4 text-brand-500 focus:ring-brand-500"
              />
              <div>
                <p className="text-sm font-medium text-[var(--hp-text-primary)]">{opt.label}</p>
                <p className="text-xs text-[var(--hp-text-muted)]">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>
      {/* Categorias */}
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
              onChange={(v) =>
                save({
                  ...prefs,
                  categories: { ...prefs.categories, newActivities: v },
                })
              }
            />
          </div>
          <div className="flex items-center justify-between opacity-50">
            <div>
              <p className="text-sm font-medium text-[var(--hp-text-muted)]">Actualizaciones de favoritos</p>
              <p className="text-xs text-[var(--hp-text-muted)]">Cambios en tus actividades guardadas</p>
            </div>
            <Toggle checked={false} onChange={() => {}} disabled />
          </div>
          <div className="flex items-center justify-between opacity-50">
            <div>
              <p className="text-sm font-medium text-[var(--hp-text-muted)]">Anuncios de proveedores</p>
              <p className="text-xs text-[var(--hp-text-muted)]">Noticias de organizadores</p>
            </div>
            <Toggle checked={false} onChange={() => {}} disabled />
          </div>
        </div>
      </section>
      {saving && (
        <p className="text-xs text-[var(--hp-text-muted)] mt-3 text-center">Guardando...</p>
      )}
    </div>
  );
}
