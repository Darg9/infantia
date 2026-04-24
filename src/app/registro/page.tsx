'use client';

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button, Input, Card } from '@/components/ui'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Auth')

// Feature flag — activar cuando tengamos proveedor SMS configurado
const ENABLE_PHONE_OTP = process.env.NEXT_PUBLIC_ENABLE_PHONE_OTP === 'true'

function RegistroForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [aceptaTerminos, setAceptaTerminos] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [authMode, setAuthMode] = useState<'options' | 'email'>('options')
  const [emailSent, setEmailSent] = useState(false)
  const [isApple, setIsApple] = useState(false)

  useEffect(() => {
    setIsApple(/Mac|iPod|iPhone|iPad/.test(navigator.platform))
  }, [])

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      }
    })

    if (authError) {
      logger.error('Error OAuth', { action: 'oauth_register', provider, reason: authError.message })
      setError(authError.message)
      setLoading(false)
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!aceptaTerminos) {
      setError('Debes aceptar las políticas y términos para continuar.')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      setLoading(false)
      return
    }

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      logger.error('Fallo en el registro', { action: 'register', result: 'error', reason: authError.message })
      setError(authError.message)
      setLoading(false)
      return
    }

    logger.info('Registro exitoso', { action: 'register', result: 'success' })
    setEmailSent(true)
    setLoading(false)
  }

  if (emailSent) {
    return (
      <Card className="w-full max-w-md text-center p-8">
        <div className="text-4xl mb-4">📧</div>
        <h1 className="text-xl font-bold text-[var(--hp-text-primary)] mb-2">Revisa tu correo</h1>
        <p className="text-[var(--hp-text-secondary)] text-sm">
          Te enviamos un enlace de confirmación a <strong>{email}</strong>.
          Haz clic en el enlace para activar tu cuenta.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-brand-600 text-sm font-medium hover:underline"
        >
          Volver a inicio de sesión
        </Link>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="text-2xl font-bold text-[var(--hp-text-primary)] mb-2">Crea tu cuenta</h1>
      <p className="text-[var(--hp-text-secondary)] text-sm mb-6">Únete a HabitaPlan y descubre actividades</p>

      {error && (
        <p className="mb-4 text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

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
            Registrarse con Correo-e
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

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[var(--hp-border)]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--hp-bg-surface)] px-2 text-[var(--hp-text-muted)]">Más opciones</span>
            </div>
          </div>


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

      {authMode === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <Input
              id="registro-nombre"
              label="Nombre o apodo"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ej: Mamá de Sofi"
            />
          </div>
          <div>
            <Input
              id="registro-email"
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
              id="registro-password"
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div className="flex items-start gap-2">
            <Input
              type="checkbox"
              id="acepta-terminos"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              required
              className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
            />
            <label htmlFor="acepta-terminos" className="text-xs text-[var(--hp-text-secondary)] leading-relaxed">
              Acepto la{' '}
              <Link
                href="/seguridad/datos"
                target="_blank"
                className="text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 rounded-sm"
                onClick={(e) => e.stopPropagation()}
              >
                Política de Tratamiento de Datos Personales
              </Link>{' '}
              y los{' '}
              <Link
                href="/terminos"
                target="_blank"
                className="text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 rounded-sm"
                onClick={(e) => e.stopPropagation()}
              >
                Términos de Uso
              </Link>.
            </label>
          </div>

          <Button type="submit" disabled={loading || !aceptaTerminos} loading={loading} className="w-full">
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </Button>
          <button
            type="button"
            onClick={() => { setAuthMode('options'); setError(null) }}
            className="w-full text-center text-sm text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)]"
          >
            Volver a opciones
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-[var(--hp-text-secondary)]">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-brand-600 font-medium hover:underline">
          Inicia sesión
        </Link>
      </p>
    </Card>
  )
}

export default function RegistroPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--hp-bg-page)] py-12 px-4 sm:px-6 lg:px-8">
      <Suspense>
        <RegistroForm />
      </Suspense>
    </div>
  )
}
