'use client';
import { Button } from '@/components/ui';
import { buttonVariants } from '@/components/ui/button';
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const INPUT_CLS =
  'w-full px-3 py-2 border border-[var(--hp-border-subtle)] rounded-lg text-sm ' +
  'bg-[var(--hp-bg-surface)] text-[var(--hp-text-primary)] ' +
  'placeholder:text-[var(--hp-text-muted)] ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ' +
  '[color-scheme:light] dark:[color-scheme:dark]'

const SELECT_CLS =
  'w-full px-3 py-2 border border-[var(--hp-border-subtle)] rounded-lg text-sm ' +
  'bg-[var(--hp-bg-surface)] text-[var(--hp-text-primary)] ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ' +
  '[color-scheme:light] dark:[color-scheme:dark] ' +
  '[&>option]:bg-[var(--hp-bg-surface)] [&>option]:text-[var(--hp-text-primary)]'

interface Props {
  childId: string
  initialName: string
  initialBirthDate: string  // "YYYY-MM-DD"
  initialGender: string
}

export function EditChildForm({ childId, initialName, initialBirthDate, initialGender }: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [birthDate, setBirthDate] = useState(initialBirthDate)
  const [gender, setGender] = useState(initialGender)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isDirty =
    name !== initialName ||
    birthDate !== initialBirthDate ||
    gender !== initialGender

  const today = new Date()
  const maxDate = today.toISOString().split('T')[0]
  const minDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
    .toISOString()
    .split('T')[0]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isDirty) {
      router.push('/perfil/hijos')
      return
    }
    setError(null)
    setLoading(true)

    const res = await fetch(`/api/children/${childId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, birthDate, gender: gender || null }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Error al guardar los cambios')
      setLoading(false)
      return
    }

    router.push('/perfil/hijos')
    router.refresh()
  }

  return (
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

      {/* Nota sobre consentimiento — no requiere nueva autorización */}
      <p className="text-xs text-[var(--hp-text-muted)] leading-relaxed">
        La autorización de tratamiento de datos otorgada al crear el perfil sigue vigente.
        Solo se actualizan los datos del menor.
      </p>

      {error && (
        <p className="text-sm text-error-600 dark:text-error-400 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Botones */}
      <div className="flex gap-3">
        <Link
          href="/perfil/hijos"
          className={buttonVariants({ variant: 'secondary', size: 'md' }) + ' flex-1 justify-center'}
        >
          Volver
        </Link>
        <Button
          type="submit"
          variant="primary"
          disabled={loading}
          className="flex-1"
        >
          {loading ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}
