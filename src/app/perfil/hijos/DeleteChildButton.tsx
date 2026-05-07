'use client';

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteChildButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleConfirm() {
    setLoading(true)
    await fetch(`/api/children/${id}`, { method: 'DELETE' })
    router.refresh()
    setLoading(false)
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-[var(--hp-text-secondary)] hidden sm:inline">¿Eliminar a {name}?</span>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="text-xs font-semibold text-white bg-error-500 hover:bg-error-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        >
          {loading ? 'Eliminando…' : 'Sí, eliminar'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="text-xs text-[var(--hp-text-muted)] hover:text-[var(--hp-text-secondary)] px-2 py-1.5 transition-colors"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-xs font-medium text-error-500 border border-error-200 dark:border-error-800 hover:bg-error-50 dark:hover:bg-error-900/20 px-3 py-1.5 rounded-lg transition-colors shrink-0"
    >
      Eliminar
    </button>
  )
}
