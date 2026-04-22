'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button, Input, Card } from '@/components/ui'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Auth')

// Feature flag — activar cuando tengamos proveedor SMS configurado
const ENABLE_PHONE_OTP = process.env.NEXT_PUBLIC_ENABLE_PHONE_OTP === 'true'

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [authMode, setAuthMode] = useState<'options' | 'email' | 'email-password' | 'magic-sent'>('options')
  const [isApple, setIsApple] = useState(false)

  useEffect(() => {
    setIsApple(/Mac|iPod|iPhone|iPad/.test(navigator.platform))
  }, [])

  const handleOAuth = async (provider: 'google' | 'facebook' | 'apple') => {
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      }
    })

    if (authError) {
      logger.error('Error OAuth', { action: 'oauth', provider, reason: authError.message })
      setError(authError.message)
      setLoading(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      }
    })

    if (authError) {
      logger.error('Error Magic Link', { action: 'magic_link', reason: authError.message })
      setError(authError.message)
      setLoading(false)
      return
    }

    logger.info('Magic Link enviado', { action: 'magic_link', result: 'success' })
    setAuthMode('magic-sent')
    setLoading(false)
  }

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      logger.error('Error credenciales', { action: 'login', result: 'error', reason: authError.message })
      setError('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }

    logger.info('Login exitoso', { action: 'login', result: 'success' })
    window.location.href = `/auth/callback?next=${encodeURIComponent(redirectTo)}`
  }

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="text-2xl font-bold text-[var(--hp-text-primary)] mb-2">Inicia sesión</h1>
      <p className="text-[var(--hp-text-secondary)] text-sm mb-6">Bienvenido de vuelta a HabitaPlan</p>

      {error && (
        <p className="mb-4 text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* OPCIONES PRINCIPALES */}
      {authMode === 'options' && (
        <div className="space-y-3">
          <Button
            variant="secondary"
            className="w-full justify-center gap-2"
            onClick={() => handleOAuth('google')}
            disabled={loading}
          >
            Continuar con Google
          </Button>

          <Button
            variant="secondary"
            className="w-full justify-center gap-2"
            onClick={() => setAuthMode('email')}
          >
            Continuar con Email
          </Button>

          {ENABLE_PHONE_OTP && (
            <Button
              variant="ghost"
              className="w-full justify-center gap-2 text-[var(--hp-text-secondary)]"
              onClick={() => setAuthMode('options')} // placeholder
            >
              Continuar con Teléfono
            </Button>
          )}

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[var(--hp-border)]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--hp-bg-surface)] px-2 text-[var(--hp-text-muted)]">Más opciones</span>
            </div>
          </div>

          <Button
            variant="ghost"
            className="w-full justify-center gap-2 text-[var(--hp-text-secondary)]"
            onClick={() => handleOAuth('facebook')}
          >
            Continuar con Facebook
          </Button>
          {isApple && (
            <Button
              variant="ghost"
              className="w-full justify-center gap-2 text-[var(--hp-text-secondary)]"
              onClick={() => handleOAuth('apple')}
            >
              Continuar con Apple
            </Button>
          )}
        </div>
      )}

      {/* MAGIC LINK (email primario) */}
      {authMode === 'email' && (
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div>
            <Input
              id="login-email"
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@correo.com"
            />
          </div>
          <Button type="submit" disabled={loading} loading={loading} className="w-full">
            {loading ? 'Enviando...' : 'Recibir enlace de acceso'}
          </Button>
          <button
            type="button"
            onClick={() => { setAuthMode('email-password'); setError(null) }}
            className="w-full text-center text-xs text-[var(--hp-text-muted)] hover:text-[var(--hp-text-secondary)] mt-1"
          >
            ¿Tienes contraseña? Usar contraseña
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('options'); setError(null) }}
            className="w-full text-center text-sm text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)]"
          >
            Volver a opciones
          </button>
        </form>
      )}

      {/* MAGIC LINK ENVIADO */}
      {authMode === 'magic-sent' && (
        <div className="text-center py-4 space-y-4">
          <div className="text-4xl">📧</div>
          <p className="text-[var(--hp-text-primary)] font-semibold">Revisa tu correo</p>
          <p className="text-[var(--hp-text-secondary)] text-sm">
            Enviamos un enlace de acceso a <strong>{email}</strong>.<br />
            Haz clic en él para entrar automáticamente.
          </p>
          <button
            type="button"
            onClick={() => { setAuthMode('email'); setError(null) }}
            className="text-sm text-brand-600 hover:underline"
          >
            Reenviar enlace
          </button>
        </div>
      )}

      {/* EMAIL + CONTRASEÑA (fallback) */}
      {authMode === 'email-password' && (
        <form onSubmit={handleEmailPassword} className="space-y-4">
          <div>
            <Input
              id="login-email-pw"
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@correo.com"
            />
          </div>
          <div>
            <Input
              id="login-password"
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" disabled={loading} loading={loading} className="w-full">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
          <button
            type="button"
            onClick={() => { setAuthMode('email'); setError(null) }}
            className="w-full text-center text-sm text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)]"
          >
            Volver al enlace mágico
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-[var(--hp-text-secondary)]">
        ¿No tienes cuenta?{' '}
        <Link href="/registro" className="text-brand-600 font-medium hover:underline">
          Regístrate
        </Link>
      </p>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--hp-bg-page)] p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
