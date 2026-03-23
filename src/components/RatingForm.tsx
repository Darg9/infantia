'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StarRating } from './StarRating'

interface RatingFormProps {
  activityId: string
  existingScore?: number | null
  existingComment?: string | null
  isAuthenticated: boolean
}

export function RatingForm({ activityId, existingScore, existingComment, isAuthenticated }: RatingFormProps) {
  const router = useRouter()
  const [score, setScore] = useState(existingScore ?? 0)
  const [comment, setComment] = useState(existingComment ?? '')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  if (!isAuthenticated) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-500">
          <a href="/login" className="text-orange-600 hover:underline font-medium">Inicia sesion</a>{' '}
          para calificar esta actividad.
        </p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (score === 0) {
      setMsg({ type: 'error', text: 'Selecciona al menos 1 estrella' })
      return
    }

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
        setMsg({ type: 'success', text: existingScore ? 'Calificacion actualizada' : 'Calificacion guardada' })
        router.refresh()
      }
    } catch {
      setMsg({ type: 'error', text: 'Error de conexion' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center gap-3">
        <StarRating value={score} onChange={setScore} size="lg" />
        {score > 0 && (
          <span className="text-sm text-gray-500">{score}/5</span>
        )}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Escribe un comentario (opcional, max 500 caracteres)"
        maxLength={500}
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
      />

      {msg && (
        <p className={`text-sm px-3 py-2 rounded-lg ${
          msg.type === 'success'
            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
            : 'text-red-600 bg-red-50 border border-red-200'
        }`}>
          {msg.text}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || score === 0}
        className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
      >
        {loading ? 'Guardando...' : existingScore ? 'Actualizar calificacion' : 'Enviar calificacion'}
      </button>
    </form>
  )
}
