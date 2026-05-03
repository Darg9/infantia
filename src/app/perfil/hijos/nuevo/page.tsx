'use client';
import { Button, Input } from '@/components/ui';

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const CONSENT_TEXT =
  'Soy el padre, madre o tutor legal de este menor y autorizo el tratamiento de sus datos personales ' +
  'por parte de HabitaPlan conforme a la Política de Tratamiento de Datos Personales (Ley 1581 de 2012). ' +
  'Los datos del menor se usarán exclusivamente para personalizar la búsqueda de actividades y nunca serán ' +
  'compartidos con terceros para fines comerciales.'

export default function NuevoHijoPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('')
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Límites de fecha: 0 a 18 años
  const today = new Date()
  const maxDate = today.toISOString().split('T')[0]
  const minDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
    .toISOString()
    .split('T')[0]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!consentAccepted) {
      setError('Debes aceptar la autorización de tratamiento de datos para continuar.')
      return
    }

    setLoading(true)

    const res = await fetch('/api/children', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, birthDate, gender: gender || null, consentAccepted }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Error al guardar el perfil')
      setLoading(false)
      return
    }

    router.push('/perfil/hijos')
    router.refresh()
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-[var(--hp-text-primary)] mb-1">Agregar una niña o niño</h1>
      <p className="text-sm text-[var(--hp-text-secondary)] mb-8">
        Esto nos ayuda a recomendarte actividades adecuadas para su edad.
      </p>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-[var(--hp-text-primary)] mb-1">
            Nombre <span className="text-error-500">*</span>
          </label>
          { }
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className='w-full px-3 py-2 border border-[var(--hp-border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
            placeholder="Nombre de la niña o niño"
          />
        </div>

        {/* Fecha de nacimiento */}
        <div>
          <label className="block text-sm font-medium text-[var(--hp-text-primary)] mb-1">
            Fecha de nacimiento <span className="text-error-500">*</span>
          </label>
          { }
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
            min={minDate}
            max={maxDate}
            className='w-full px-3 py-2 border border-[var(--hp-border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
          />
          <p className="text-xs text-[var(--hp-text-muted)] mt-1">Solo perfiles de menores de 18 años</p>
        </div>

        {/* Género (opcional) */}
        <div>
          <label className="block text-sm font-medium text-[var(--hp-text-primary)] mb-1">
            Género <span className="text-[var(--hp-text-muted)] font-normal">(opcional)</span>
          </label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className='w-full px-3 py-2 border border-[var(--hp-border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
          >
            <option value="">Prefiero no indicar</option>
            <option value="niño">Niño</option>
            <option value="niña">Niña</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        {/* Autorización parental — Ley 1581 */}
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-brand-800 mb-2">
            Autorización de tratamiento de datos personales
          </h2>
          <p className='text-xs text-[var(--hp-text-secondary)] leading-relaxed mb-3'>{CONSENT_TEXT}</p>
          <p className="text-xs text-[var(--hp-text-secondary)] mb-3">
            Conforme a la{' '}
            <Link
              href="/seguridad/datos"
              target="_blank"
              className="text-brand-600 hover:underline"
            >
              Política de Tratamiento de Datos Personales
            </Link>{' '}
            de HabitaPlan y la Ley 1581 de 2012.
          </p>
          <div className="flex items-start gap-2">
            <Input
              type="checkbox"
              id="consent"
              checked={consentAccepted}
              onChange={(e) => setConsentAccepted(e.target.checked)}
              className='mt-0.5 h-4 w-4 rounded border-[var(--hp-border-subtle)] text-brand-500 focus:ring-brand-500'
            />
            <label htmlFor="consent" className="text-xs text-[var(--hp-text-primary)] font-medium leading-relaxed">
              Confirmo que soy el padre, madre o tutor legal de este menor y acepto la autorización
              de tratamiento de sus datos personales. <span className="text-error-500">*</span>
            </label>
          </div>
        </div>

        {error && (
          <p className="text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Link
            href="/perfil/hijos"
            className='flex-1 text-center py-2.5 border border-[var(--hp-border-subtle)] rounded-lg text-sm text-[var(--hp-text-secondary)] hover:bg-[var(--hp-bg-page)] transition-colors'
          >
            Cancelar
          </Link>
          <Button
            type="submit"
            disabled={loading || !consentAccepted}
            className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Guardando...' : 'Guardar perfil'}
          </Button>
        </div>
      </form>
    </div>
  );
}
