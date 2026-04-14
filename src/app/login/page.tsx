'use client'

import { Suspense, useState } from 'react'
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
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
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

    // Verificar si el usuario necesita onboarding
    const profileRes = await fetch('/api/profile/me')
    if (profileRes.ok) {
      const profile = await profileRes.json()
      if (!profile.onboardingDone) {
        router.push('/onboarding')
        return
      }
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Inicia sesión</h1>
      <p className="text-gray-500 text-sm mb-6">Bienvenido de vuelta a HabitaPlan</p>

      <form onSubmit={handleSubmit} className="space-y-4">
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

        {error && (
          <p className="text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          loading={loading}
          className="w-full"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
