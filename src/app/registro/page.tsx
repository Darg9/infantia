'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button, Input, Card } from '@/components/ui'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Auth')

export default function RegistroPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [aceptaTerminos, setAceptaTerminos] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (password.length < 8) {
      logger.warn('Intento de password corto', { action: 'register', result: 'attempt', reason: 'password_too_short' })
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

    // Email de bienvenida se envía en /auth/callback después de confirmar
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md text-center">
          <div className="text-4xl mb-4">📧</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Revisa tu correo</h1>
          <p className="text-gray-500 text-sm">
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
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Crea tu cuenta</h1>
        <p className="text-gray-500 text-sm mb-6">Únete a HabitaPlan y descubre actividades</p>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Aceptación de políticas — obligatorio por Ley 1581 de 2012 */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="acepta-terminos"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              required
              className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
            />
            <label htmlFor="acepta-terminos" className="text-xs text-gray-500 leading-relaxed">
              Acepto la{' '}
              <Link href="/tratamiento-datos" target="_blank" className="text-brand-600 hover:underline">
                Política de Tratamiento de Datos Personales
              </Link>{' '}
              y los{' '}
              <Link href="/terminos" target="_blank" className="text-brand-600 hover:underline">
                Términos de Uso
              </Link>.
            </label>
          </div>

          {error && (
            <p className="text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || !aceptaTerminos}
            loading={loading}
            className="w-full"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-brand-600 font-medium hover:underline">
            Inicia sesión
          </Link>
        </p>
      </Card>
    </div>
  )
}
