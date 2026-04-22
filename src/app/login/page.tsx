'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button, Input, Card } from '@/components/ui'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Auth')

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [authMode, setAuthMode] = useState<'options' | 'email' | 'phone' | 'otp'>('options')
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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Basic normalization: remove spaces, ensure + prefix
    let normalizedPhone = phone.trim().replace(/\s/g, '')
    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = `+${normalizedPhone}`
    }

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithOtp({ phone: normalizedPhone })

    if (authError) {
      logger.error('Error OTP', { action: 'send_otp', reason: authError.message })
      setError(authError.message)
      setLoading(false)
      return
    }

    setAuthMode('otp')
    setLoading(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })

    if (authError) {
      logger.error('Error verify OTP', { action: 'verify_otp', reason: authError.message })
      setError('Código incorrecto o expirado')
      setLoading(false)
      return
    }

    // On verify, supabase logs the user in. We redirect to callback.
    window.location.href = `/auth/callback?next=${encodeURIComponent(redirectTo)}`
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      logger.error('Error de credenciales', { action: 'login', result: 'error', reason: authError.message })
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

      {authMode === 'options' && (
        <div className="space-y-4">
          <Button variant="secondary" className="w-full justify-center gap-2" onClick={() => handleOAuth('google')}>
            Continuar con Google
          </Button>
          <Button variant="secondary" className="w-full justify-center gap-2" onClick={() => setAuthMode('phone')}>
            Continuar con Teléfono
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[var(--hp-border)]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--hp-bg-surface)] px-2 text-[var(--hp-text-muted)]">Más opciones</span>
            </div>
          </div>

          <Button variant="ghost" className="w-full justify-center gap-2 text-[var(--hp-text-secondary)]" onClick={() => handleOAuth('facebook')}>
            Continuar con Facebook
          </Button>
          {isApple && (
            <Button variant="ghost" className="w-full justify-center gap-2 text-[var(--hp-text-secondary)]" onClick={() => handleOAuth('apple')}>
              Continuar con Apple
            </Button>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[var(--hp-border)]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--hp-bg-surface)] px-2 text-[var(--hp-text-muted)]">O usa tu correo</span>
            </div>
          </div>

          <Button variant="ghost" className="w-full justify-center gap-2 text-brand-600 bg-brand-50 hover:bg-brand-100" onClick={() => setAuthMode('email')}>
            Iniciar sesión con Email
          </Button>
        </div>
      )}

      {authMode === 'phone' && (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <Input
              id="login-phone"
              label="Número de Teléfono (con código de país)"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="+573001234567"
            />
          </div>
          <Button type="submit" disabled={loading} loading={loading} className="w-full">
            {loading ? 'Enviando...' : 'Enviar código SMS'}
          </Button>
          <button type="button" onClick={() => { setAuthMode('options'); setError(null) }} className="w-full text-center text-sm text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)] mt-2">
            Volver a opciones
          </button>
        </form>
      )}

      {authMode === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <Input
              id="login-otp"
              label="Código SMS"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              placeholder="123456"
            />
          </div>
          <Button type="submit" disabled={loading} loading={loading} className="w-full">
            {loading ? 'Verificando...' : 'Verificar código'}
          </Button>
          <button type="button" onClick={() => { setAuthMode('phone'); setError(null) }} className="w-full text-center text-sm text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)] mt-2">
            Cambiar número
          </button>
        </form>
      )}

      {authMode === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
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
          <button type="button" onClick={() => { setAuthMode('options'); setError(null) }} className="w-full text-center text-sm text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)] mt-2">
            Volver a opciones
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
