'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button, Input, Card } from '@/components/ui'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Auth')

const ENABLE_PHONE_OTP = process.env.NEXT_PUBLIC_ENABLE_PHONE_OTP === 'true'

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent'>('idle')
  const [cooldown, setCooldown] = useState(0)
  const [isApple, setIsApple] = useState(false)

  useEffect(() => {
    setIsApple(/Mac|iPod|iPhone|iPad/.test(navigator.platform))
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const startCooldown = () => setCooldown(60)

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setLoading(true)
    setError(null)
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
    setStatus('loading')

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      }
    })

    if (authError) {
      logger.error('Error Magic Link', { action: 'magic_link', reason: authError.message })
      setError('No pudimos enviar el enlace. Intenta nuevamente.')
      setStatus('idle')
      return
    }

    logger.info('Magic Link enviado', { action: 'magic_link', result: 'success' })
    setStatus('sent')
    startCooldown()
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

      {/* SSO — Siempre visible */}
      <div className="space-y-3 mb-6">
        <Button
          variant="secondary"
          className="w-full justify-center gap-2"
          onClick={() => handleOAuth('google')}
          disabled={loading || status === 'loading'}
        >
          Continuar con Google
        </Button>

        {ENABLE_PHONE_OTP && (
          <Button
            variant="ghost"
            className="w-full justify-center gap-2 text-[var(--hp-text-secondary)]"
            disabled
          >
            Continuar con Teléfono
          </Button>
        )}

        {/* Más opciones colapsadas */}
        {isApple && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-[var(--hp-text-muted)]"
            onClick={() => handleOAuth('apple')}
            disabled={loading || status === 'loading'}
          >
            Apple
          </Button>
        )}
      </div>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[var(--hp-border)]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[var(--hp-bg-surface)] px-2 text-[var(--hp-text-muted)]">O usa tu correo-e</span>
        </div>
      </div>

      {/* Bloque de correo-e */}
      {status === 'sent' ? (
        <div className="rounded-xl bg-success-50 border border-success-200 text-center space-y-3 py-6 px-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-success-100 mx-auto">
            <svg className="w-6 h-6 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-[var(--hp-text-primary)] font-semibold">Enlace enviado</p>
          <p className="text-[var(--hp-text-secondary)] text-sm">
            Enviamos un enlace a <strong>{email}</strong>.<br />
            Haz clic en él para entrar. Revisa también tu carpeta de Spam.
          </p>
          {/* Email editable por si se equivocó */}
          <button
            type="button"
            onClick={() => { setStatus('idle'); setError(null) }}
            className="text-xs text-[var(--hp-text-muted)] hover:text-[var(--hp-text-secondary)] underline"
          >
            Cambiar correo
          </button>
          <div className="pt-2">
            {cooldown > 0 ? (
              <p className="text-xs text-[var(--hp-text-muted)]">Reenviar en {cooldown}s</p>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  const supabase = createSupabaseBrowserClient()
                  await supabase.auth.signInWithOtp({
                    email,
                    options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}` }
                  })
                  startCooldown()
                }}
                className="text-sm text-brand-600 hover:underline"
              >
                Reenviar enlace
              </button>
            )}
          </div>
        </div>
      ) : !showPassword ? (
        /* Magic Link (primario) */
        <form onSubmit={handleMagicLink} className="space-y-3">
          <Input
            id="login-email"
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            placeholder="tu@correo.com"
          />
          <p className="text-xs text-[var(--hp-text-muted)]">
            Te enviaremos un enlace seguro para acceder sin contraseña.
          </p>
          <Button
            type="submit"
            disabled={status === 'loading'}
            loading={status === 'loading'}
            className="w-full"
          >
            {status === 'loading' ? 'Enviando...' : 'Enviarme enlace de acceso'}
          </Button>
          <button
            type="button"
            onClick={() => setShowPassword(true)}
            className="w-full text-center text-xs text-[var(--hp-text-muted)] hover:text-[var(--hp-text-secondary)] pt-1"
          >
            ¿Tienes contraseña? Inicia sesión
          </button>
        </form>
      ) : (
        /* Contraseña (fallback) */
        <form onSubmit={handleEmailPassword} className="space-y-3">
          <Input
            id="login-email-pw"
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="tu@correo.com"
          />
          <Input
            id="login-password"
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
          <Button type="submit" disabled={loading} loading={loading} className="w-full">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
          <button
            type="button"
            onClick={() => { setShowPassword(false); setError(null) }}
            className="w-full text-center text-xs text-[var(--hp-text-muted)] hover:text-[var(--hp-text-secondary)] pt-1"
          >
            Volver al enlace de acceso
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
