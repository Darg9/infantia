'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { StarRating } from './StarRating'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface RatingFormProps {
  activityId: string
  existingScore?: number | null
  existingComment?: string | null
  isAuthenticated: boolean
}

// ── Modal de login rápido ─────────────────────────────────────────────────────

interface LoginModalProps {
  onSuccess: () => void
  onClose: () => void
}

function LoginModal({ onSuccess, onClose }: LoginModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [registered, setRegistered] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createSupabaseBrowserClient()

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('Correo o contraseña incorrectos')
        setLoading(false)
        return
      }
      onSuccess()
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError('No se pudo crear la cuenta. Intenta con otro correo.')
        setLoading(false)
        return
      }
      setRegistered(true)
      setLoading(false)
    }
  }

  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Fondo oscuro */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 flex flex-col gap-4">

        {/* Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Cerrar"
        >
          ✕
        </button>

        {registered ? (
          /* Estado: registro exitoso, confirmar correo */
          <div className="text-center py-2">
            <span className="text-3xl mb-3 block">📬</span>
            <h2 className="font-bold text-gray-900 text-lg mb-1">Revisa tu correo</h2>
            <p className="text-sm text-gray-500">
              Te enviamos un enlace de confirmación a <strong>{email}</strong>.
              Una vez confirmado, vuelve aquí para enviar tu calificación.
            </p>
            <button
              onClick={onClose}
              className="mt-4 text-sm text-brand-600 hover:underline font-medium"
            >
              Entendido
            </button>
          </div>
        ) : (
          <>
            {/* Encabezado */}
            <div>
              <h2 className="font-bold text-gray-900 text-lg leading-tight">
                {mode === 'login' ? 'Guarda tu opinión iniciando sesión' : 'Crea tu cuenta gratis'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {mode === 'login'
                  ? 'Tu calificación se enviará automáticamente al ingresar.'
                  : 'Confirma tu correo y luego envía tu calificación.'}
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@correo.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Contraseña"
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />

              {error && (
                <p className="text-xs text-error-600 bg-error-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
              >
                {loading
                  ? 'Un momento...'
                  : mode === 'login'
                  ? 'Ingresar y enviar calificación'
                  : 'Crear cuenta'}
              </button>
            </form>

            {/* Toggle login/registro */}
            <p className="text-center text-xs text-gray-500">
              {mode === 'login' ? (
                <>¿No tienes cuenta?{' '}
                  <button
                    onClick={() => { setMode('register'); setError(null) }}
                    className="text-brand-600 font-medium hover:underline"
                  >
                    Regístrate
                  </button>
                </>
              ) : (
                <>¿Ya tienes cuenta?{' '}
                  <button
                    onClick={() => { setMode('login'); setError(null) }}
                    className="text-brand-600 font-medium hover:underline"
                  >
                    Inicia sesión
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Formulario principal ──────────────────────────────────────────────────────

export function RatingForm({ activityId, existingScore, existingComment, isAuthenticated }: RatingFormProps) {
  const router = useRouter()
  const [score, setScore] = useState(existingScore ?? 0)
  const [comment, setComment] = useState(existingComment ?? '')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showModal, setShowModal] = useState(false)

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
      // Guardar estado y mostrar modal de login
      setShowModal(true)
      return
    }

    await submitRating()
  }

  // Tras login exitoso en el modal: enviar automáticamente
  async function handleLoginSuccess() {
    setShowModal(false)
    await submitRating()
  }

  const isExisting = !!existingScore

  return (
    <>
      {showModal && (
        <LoginModal
          onSuccess={handleLoginSuccess}
          onClose={() => setShowModal(false)}
        />
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Paso 1 — Estrellas */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            {isExisting ? 'Tu calificación actual' : '¿Cómo calificarías esta actividad?'}
          </p>
          <div className="flex items-center gap-3">
            <StarRating value={score} onChange={(v) => { setScore(v); setMsg(null) }} size="lg" />
            {score > 0 && (
              <span className="text-sm text-gray-400">{score}/5</span>
            )}
          </div>
        </div>

        {/* Paso 2 — Textarea (aparece al seleccionar estrella) */}
        <div
          className={`transition-all duration-200 overflow-hidden ${
            step === 2 ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
          }`}
        >
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            ¿Qué te gustó o qué mejorarías? <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Cuéntanos tu experiencia..."
            maxLength={500}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Mensaje de feedback */}
        {msg && (
          <p className={`text-sm px-3 py-2 rounded-lg ${
            msg.type === 'success'
              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
              : 'text-error-600 bg-error-50 border border-red-200'
          }`}>
            {msg.text}
          </p>
        )}

        {/* Paso 3 — Botón siempre visible, activo solo con estrella */}
        <button
          type="submit"
          disabled={loading || score === 0}
          className="self-start bg-brand-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-5 rounded-lg text-sm transition-colors"
        >
          {loading
            ? 'Enviando...'
            : isExisting
            ? 'Actualizar calificación'
            : 'Enviar calificación'}
        </button>

        {/* Microcopy para usuarios no autenticados */}
        {!isAuthenticated && score === 0 && (
          <p className="text-xs text-gray-400">
            Selecciona una estrella para calificar
          </p>
        )}
        {!isAuthenticated && score > 0 && (
          <p className="text-xs text-gray-400">
            Al enviar te pediremos que inicies sesión para guardar tu opinión
          </p>
        )}
      </form>
    </>
  )
}
