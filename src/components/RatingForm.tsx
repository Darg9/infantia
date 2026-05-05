'use client';
import { Button } from '@/components/ui';

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { StarRating } from './StarRating'
import { requireAuth } from '@/lib/require-auth'

interface RatingFormProps {
  activityId: string
  existingScore?: number | null
  existingComment?: string | null
  isAuthenticated: boolean
}

// ── Formulario principal ──────────────────────────────────────────────────────

export function RatingForm({ activityId, existingScore, existingComment, isAuthenticated }: RatingFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [score, setScore] = useState(existingScore ?? 0)
  const [comment, setComment] = useState(existingComment ?? '')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Paso 1: solo estrellas visible | Paso 2: estrellas + textarea
  const step = score > 0 ? 2 : 1

  async function submitRating() {
    setMsg(null)
    setLoading(true)
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, score, comment: comment.trim() || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        setMsg({ type: 'error', text: data.error ?? 'Error al guardar' })
      } else {
        setMsg({ type: 'success', text: existingScore ? 'Calificación actualizada ✓' : 'Calificación enviada ✓' })
        router.refresh()
      }
    } catch {
      setMsg({ type: 'error', text: 'Error de conexión' })
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (score === 0) return

    if (!isAuthenticated) {
      // Guardar intent y redirigir al login — IntentResolver lo ejecuta al volver
      await requireAuth({
        type: 'RATE',
        activityId,
        score,
        comment: comment.trim() || undefined,
        returnTo: pathname,
      }, router)
      return
    }

    await submitRating()
  }

  const isExisting = !!existingScore

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* Paso 1 — Estrellas */}
      <div>
        <p className="text-sm font-medium text-[var(--hp-text-primary)] mb-2">
          {isExisting ? 'Tu calificación actual' : '¿Cómo calificarías esta actividad?'}
        </p>
        <div className="flex items-center gap-3">
          <StarRating value={score} onChange={(v) => { setScore(v); setMsg(null) }} size="lg" />
          {score > 0 && (
            <span className="text-sm text-[var(--hp-text-muted)]">{score}/5</span>
          )}
        </div>
      </div>

      {/* Paso 2 — Textarea (aparece al seleccionar estrella) */}
      <div
        className={`transition-all duration-200 overflow-hidden ${
          step === 2 ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <label className="block text-sm font-medium text-[var(--hp-text-primary)] mb-1.5">
          ¿Qué te gustó o qué mejorarías? <span className="text-[var(--hp-text-muted)] font-normal">(opcional)</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Cuéntanos tu experiencia..."
          maxLength={500}
          rows={3}
          className='w-full px-3 py-2 border border-[var(--hp-border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none'
        />
      </div>

      {/* Mensaje de feedback */}
      {msg && (
        <p className={`text-sm px-3 py-2 rounded-lg ${
          msg.type === 'success'
            ? 'text-success-700 bg-success-50 border border-success-200'
            : 'text-error-600 bg-error-50 border border-error-200'
        }`}>
          {msg.text}
        </p>
      )}

      {/* Paso 3 — Botón CTA */}
      <Button
        type="submit"
        variant="primary"
        disabled={loading || score === 0}
        className='self-start disabled:opacity-40 disabled:cursor-not-allowed py-2 px-5 rounded-lg text-sm font-medium'
      >
        {loading
          ? 'Enviando...'
          : isExisting
          ? 'Actualizar calificación'
          : 'Enviar calificación'}
      </Button>

      {/* Microcopy para usuarios no autenticados */}
      {!isAuthenticated && score === 0 && (
        <p className="text-xs text-[var(--hp-text-muted)]">
          Selecciona una estrella para calificar
        </p>
      )}
      {!isAuthenticated && score > 0 && (
        <p className="text-xs text-[var(--hp-text-muted)]">
          Al enviar iniciarás sesión — tu calificación se guardará automáticamente
        </p>
      )}
    </form>
  );
}
