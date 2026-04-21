'use client';
import { Button } from "@/components/ui/button";

// =============================================================================
// PushButton — solicita permiso de notificaciones push y gestiona suscripción
// =============================================================================

import { useEffect, useState } from 'react'
import { createLogger } from '@/lib/logger';

const log = createLogger('push-button');

type PushState = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export function PushButton() {
  const [state, setState] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    // Verificar si ya hay suscripción activa
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        setState(sub ? 'subscribed' : 'unsubscribed')
      })
    )
  }, [])

  async function registerSW() {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return navigator.serviceWorker.ready
  }

  async function subscribe() {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('denied')
        return
      }

      const reg = await registerSW()
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as any,
      })

      const json = sub.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
        }),
      })

      if (res.ok) setState('subscribed')
    } catch (err) {
      log.error('Subscribe error', { error: err })
    } finally {
      setBusy(false)
    }
  }

  async function unsubscribe() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('unsubscribed')
    } catch (err) {
      log.error('Unsubscribe error', { error: err })
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') {
    return (
      <div className="h-6 w-11 rounded-full bg-gray-200 animate-pulse" />
    )
  }

  if (state === 'unsupported') {
    return (
      <span className="text-xs text-[var(--hp-text-muted)] italic">No compatible con este navegador</span>
    )
  }

  if (state === 'denied') {
    return (
      <span className="text-xs text-warning-600">
        Bloqueado — activa en configuración del navegador
      </span>
    )
  }

  const checked = state === 'subscribed'
  return (
    <Button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={busy}
      onClick={checked ? unsubscribe : subscribe}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
        busy
          ? 'bg-gray-200 cursor-wait'
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

// Convierte VAPID public key de base64url a Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}
