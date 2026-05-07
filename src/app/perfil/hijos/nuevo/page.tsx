'use client';
import { Button } from '@/components/ui';
import { buttonVariants } from '@/components/ui/button';
import { useBeforeUnload } from '@/hooks/useBeforeUnload';

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const CONSENT_TEXT =
  'Soy el padre, madre o tutor legal de este menor y autorizo el tratamiento de sus datos personales ' +
  'por parte de HabitaPlan conforme a la Política de Tratamiento de Datos Personales (Ley 1581 de 2012). ' +
  'Los datos del menor se usarán exclusivamente para personalizar la búsqueda de actividades y nunca serán ' +
  'compartidos con terceros para fines comerciales.'

// Clase compartida para todos los campos de texto/fecha — tema aware
const INPUT_CLS =
  'w-full px-3 py-2 border border-[var(--hp-border-subtle)] rounded-lg text-sm ' +
  'bg-[var(--hp-bg-surface)] text-[var(--hp-text-primary)] ' +
  'placeholder:text-[var(--hp-text-muted)] ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ' +
  '[color-scheme:light] dark:[color-scheme:dark]'

// Clase para <select> — dropdown panel también hereda color-scheme
const SELECT_CLS =
  'w-full px-3 py-2 border border-[var(--hp-border-subtle)] rounded-lg text-sm ' +
  'bg-[var(--hp-bg-surface)] text-[var(--hp-text-primary)] ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ' +
  '[color-scheme:light] dark:[color-scheme:dark] ' +
  '[&>option]:bg-[var(--hp-bg-surface)] [&>option]:text-[var(--hp-text-primary)]'

export default function NuevoHijoPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('')
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  // Hay datos sin guardar si el usuario tocó algún campo
  const isDirty = name !== '' || birthDate !== '' || gender !== '' || consentAccepted

  // Alerta nativa del browser al cerrar pestaña / recargar / back externo
  useBeforeUnload(isDirty)

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
    <div className="max-w-lg px-4 py-10">
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
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className={INPUT_CLS}
            placeholder="Nombre de la niña o niño"
          />
        </div>

        {/* Fecha de nacimiento */}
        <div>
          <label className="block text-sm font-medium text-[var(--hp-text-primary)] mb-1">
            Fecha de nacimiento <span className="text-error-500">*</span>
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
            min={minDate}
            max={maxDate}
            className={INPUT_CLS}
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
            className={SELECT_CLS}
          >
            <option value="">Prefiero no indicar</option>
            <option value="niño">Niño</option>
            <option value="niña">Niña</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        {/* Autorización parental — Ley 1581 */}
        <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-brand-800 dark:text-brand-300 mb-2">
            Autorización de tratamiento de datos personales
          </h2>
          <p className="text-xs text-[var(--hp-text-secondary)] leading-relaxed mb-3">{CONSENT_TEXT}</p>
          <p className="text-xs text-[var(--hp-text-secondary)] mb-3">
            Conforme a la{' '}
            <Link
              href="/centro-de-confianza/datos"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 dark:text-brand-400 hover:underline"
            >
              Política de Tratamiento de Datos Personales
            </Link>{' '}
            de HabitaPlan y la Ley 1581 de 2012.
          </p>
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="consent"
              checked={consentAccepted}
              onChange={(e) => setConsentAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[var(--hp-border-subtle)] accent-brand-500 cursor-pointer"
            />
            <label htmlFor="consent" className="text-xs text-[var(--hp-text-primary)] font-medium leading-relaxed cursor-pointer">
              Confirmo que soy el padre, madre o tutor legal de este menor y acepto la autorización
              de tratamiento de sus datos personales. <span className="text-error-500">*</span>
            </label>
          </div>
        </div>

        {error && (
          <p className="text-sm text-error-600 dark:text-error-400 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Botones de acción */}
        <div className="flex gap-3">
          {/* Volver: si hay datos sin guardar, muestra confirmación inline */}
          {showLeaveConfirm ? (
            <div className="flex-1 flex items-center justify-center gap-3 rounded-xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] px-4 py-2.5">
              <span className="text-sm text-[var(--hp-text-secondary)] leading-tight">¿Salir sin guardar?</span>
              <Link
                href="/perfil/hijos"
                className="text-sm font-semibold text-error-500 hover:text-error-700 transition-colors shrink-0"
              >
                Sí, salir
              </Link>
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="text-sm text-[var(--hp-text-muted)] hover:text-[var(--hp-text-secondary)] transition-colors shrink-0"
              >
                Quedarme
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => isDirty ? setShowLeaveConfirm(true) : router.push('/perfil/hijos')}
              className={buttonVariants({ variant: 'secondary', size: 'md' }) + ' flex-1 justify-center'}
            >
              Volver
            </button>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={loading || !consentAccepted}
            className="flex-1"
          >
            {loading ? 'Guardando…' : 'Guardar perfil'}
          </Button>
        </div>
      </form>
    </div>
  );
}
