'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'

// ─── Constants ────────────────────────────────────────────────────────────────
// Alineado con Supabase Auth password policy (mínimo 8 caracteres, custom desde S45).
// Si cambias este valor, actualiza también /registro/page.tsx y /api/* que validen passwords.
const MIN_PASSWORD_LENGTH = 8
const MAX_AVATAR_SIZE     = 2 * 1024 * 1024 // 2 MB
const ALLOWED_MIME_TYPES  = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

import { createLogger } from '@/lib/logger'
const logger = createLogger('Upload')

// ─── Icons (inline SVG — no extra deps) ───────────────────────────────────────

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
    </svg>
  )
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}

function EyeSlashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function ExclamationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  )
}

// ─── Password strength helpers ─────────────────────────────────────────────────

function getPasswordStrength(pass: string): number {
  if (!pass) return 0
  let score = 0
  if (pass.length >= MIN_PASSWORD_LENGTH) score++
  if (/[A-Z]/.test(pass)) score++
  if (/[0-9]/.test(pass)) score++
  if (/[^A-Za-z0-9]/.test(pass)) score++
  return score
}

const STRENGTH_LABEL      = ['', 'Débil', 'Regular', 'Buena', 'Fuerte']
const STRENGTH_TEXT_COLOR = ['', 'text-error-500', 'text-brand-500', 'text-warning-500', 'text-emerald-600 dark:text-emerald-400']
const STRENGTH_BAR_COLOR  = ['', 'bg-error-400', 'bg-brand-400', 'bg-warning-400', 'bg-emerald-500']

// ─── InputField component ──────────────────────────────────────────────────────
// Componente local: no se importa del DS porque necesita onChange:(string)=>void
// En un futuro merge al DS si el patron se generaliza.

interface InputFieldProps {
  id: string
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  error?: string | null
  placeholder?: string
  required?: boolean
  maxLength?: number
  autoComplete?: string
  rightSlot?: React.ReactNode
}

function InputField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  required,
  maxLength,
  autoComplete,
  rightSlot,
}: InputFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && (
          <span className="text-error-500 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
          autoComplete={autoComplete}
          aria-required={required}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={error ? true : undefined}
          className={[
            'w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white dark:bg-gray-800',
            'text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0',
            rightSlot ? 'pr-10' : '',
            error
              ? 'border-error-400 dark:border-red-500 focus:ring-error-400/30 focus:border-error-400'
              : 'border-gray-200 dark:border-gray-700 focus:ring-brand-500/25 focus:border-brand-500 dark:focus:border-brand-400',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {rightSlot && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-error-600 dark:text-red-400 flex items-center gap-1">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function EditarPerfilPage() {
  const router = useRouter()
  const { toast } = useToast()
  const fileInputRef   = useRef<HTMLInputElement>(null)
  // AbortController ref: cancela el upload en vuelo si cambia archivo o desmonta
  const uploadAbortRef = useRef<AbortController | null>(null)

  // ── Basic info ──
  const [name, setName]             = useState('')
  const [initialName, setInitialName] = useState('')
  const [nameLoaded, setNameLoaded] = useState(false)
  const [basicLoading, setBasicLoading] = useState(false)
  const [nameError, setNameError]   = useState<string | null>(null)
  const [basicSaved, setBasicSaved] = useState(false)

  // ── Avatar ──
  const [avatarPreview, setAvatarPreview]       = useState<string | null>(null)
  const [avatarFile, setAvatarFile]             = useState<File | null>(null)
  const [uploadingAvatar, setUploadingAvatar]   = useState(false)
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null)

  // ── Password ──
  const [showNew, setShowNew]           = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [newPassword, setNewPassword]   = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passLoading, setPassLoading]   = useState(false)
  const [passSaved, setPassSaved]       = useState(false)
  const [passErrors, setPassErrors]     = useState<{
    newPwd?: string
    confirm?: string
  }>({})

  // ── Load user (useEffect — no render side-effects) ──
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data }: { data: { user: { user_metadata?: Record<string, string> } | null } }) => {
      if (data.user) {
        setName(data.user.user_metadata?.name ?? '')
        setInitialName(data.user.user_metadata?.name ?? '')
        if (data.user.user_metadata?.avatar_url) {
          setAvatarPreview(data.user.user_metadata.avatar_url as string)
        }
      }
      setNameLoaded(true)
    })
  }, [])

  // ── Cleanup: abortar upload en vuelo al desmontar ──
  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort()
    }
  }, [])

  // ── Auto-hide feedback ──
  useEffect(() => {
    if (basicSaved) {
      const t = setTimeout(() => setBasicSaved(false), 2500)
      return () => clearTimeout(t)
    }
  }, [basicSaved])

  useEffect(() => {
    if (passSaved) {
      const t = setTimeout(() => setPassSaved(false), 2500)
      return () => clearTimeout(t)
    }
  }, [passSaved])

  // ─── Handlers (useCallback — referencialmente estables) ───────────────────────

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Abortar upload anterior si aún está en curso
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null

    // Validar tipo MIME antes de aceptar el archivo
    if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
      toast.error('Formato no soportado. Usa JPG, PNG, WebP o GIF.')
      e.target.value = ''
      return
    }

    // Validar tamaño
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error('El archivo es demasiado grande. Máximo 2 MB.')
      e.target.value = ''
      return
    }

    // Validar dimensiones / Integridad visual (manejo imagen corrupta antes del upload)
    const url = URL.createObjectURL(file)
    const imgInfo = await new Promise<{width: number, height: number} | null>((resolve) => {
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.width, height: img.height })
        URL.revokeObjectURL(url)
      }
      img.onerror = () => {
        resolve(null)
        URL.revokeObjectURL(url)
      }
      img.src = url
    })

    if (!imgInfo) {
      toast.error('El archivo de imagen parece estar dañado o es inválido.')
      e.target.value = ''
      return
    }
    
    // Opcional: Límite mínimo de dimensiones para asegurar calidad
    if (imgInfo.width < 100 || imgInfo.height < 100) {
      toast.error('La imagen debe tener al menos 100x100 píxeles.')
      e.target.value = ''
      return
    }

    setAvatarFile(file)
    setAvatarUploadError(null)
    setBasicSaved(false)

    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)
  }, [toast])

  const isDirty = name !== initialName || avatarFile !== null

  const handleBasicSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setNameError('El nombre es obligatorio')
      return
    }
    if (!isDirty) return

    setNameError(null)
    setBasicLoading(true)
    setBasicSaved(false)

    try {
      // Upload avatar si hay uno nuevo seleccionado
      if (avatarFile) {
        // Nueva instancia del AbortController para este upload
        const ac = new AbortController()
        uploadAbortRef.current = ac

        setUploadingAvatar(true)
        setAvatarUploadError(null)

        const formData = new FormData()
        formData.append('avatar', avatarFile)

        let avatarRes: Response
        try {
          avatarRes = await fetch('/api/profile/avatar', {
            method: 'POST',
            body: formData,
            signal: ac.signal,
          })
        } catch (fetchErr) {
          if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
            setUploadingAvatar(false)
            setBasicLoading(false)
            return
          }
          logger.error('Error de red al subir avatar', { action: 'avatar_upload', result: 'error', reason: (fetchErr as Error).message })
          throw fetchErr
        }

        setUploadingAvatar(false)
        uploadAbortRef.current = null

        if (!avatarRes.ok) {
          const data = (await avatarRes.json()) as { error?: string }
          const msg = data.error ?? 'Error al subir la foto'
          logger.error('Error del servidor subiendo archivo', { action: 'avatar_upload', result: 'error', reason: msg })
          setAvatarUploadError(msg)
          toast.error(msg)
          setBasicLoading(false)
          return
        }

        logger.info('Avatar subido correctamente', { action: 'avatar_upload', result: 'success' })

        setAvatarFile(null)
        setAvatarUploadError(null)
      }

      // Guardar nombre
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        toast.error(data.error ?? 'Error al actualizar el perfil')
        return
      }

      setInitialName(name)
      setBasicSaved(true)
      router.refresh()
    } catch {
      toast.error('Error de conexión al guardar el perfil')
    } finally {
      setBasicLoading(false)
      setUploadingAvatar(false)
    }
  }, [name, isDirty, avatarFile, toast, router])

  const handlePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: typeof passErrors = {}
    if (newPassword.length < MIN_PASSWORD_LENGTH) errors.newPwd  = `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`
    if (newPassword !== confirmPassword)          errors.confirm = 'Las contraseñas no coinciden'
    if (Object.keys(errors).length > 0) {
      setPassErrors(errors)
      return
    }
    setPassErrors({})
    setPassLoading(true)
    setPassSaved(false)

    try {
      const supabase = createSupabaseBrowserClient()
      
      // NOTA: Si en el futuro es necesario, el sistema podrá pedir verificación 
      // adicional re-autenticando al usuario aquí antes de cambiar la contraseña.

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) {
        toast.error(updateError.message)
      } else {
        setPassSaved(true)
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch {
      toast.error('Error al cambiar la contraseña')
    } finally {
      setPassLoading(false)
    }
  }, [newPassword, confirmPassword, toast])

  // ─── Render helpers ───────────────────────────────────────────────────────────

  const pwStrength = getPasswordStrength(newPassword)
  const pwCriteria = [
    { ok: newPassword.length >= MIN_PASSWORD_LENGTH, label: `Mínimo ${MIN_PASSWORD_LENGTH} caracteres` },
    { ok: /[A-Z]/.test(newPassword),                 label: 'Una mayúscula' },
    { ok: /[0-9]/.test(newPassword),                 label: 'Un número' },
    { ok: /[^A-Za-z0-9]/.test(newPassword),          label: 'Un símbolo' },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-gray-900 dark:text-white">
          Editar información
        </h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Actualizá tu información personal y contraseña
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          Sección 1 — Información básica
      ══════════════════════════════════════════════════════════════ */}
      <section
        aria-labelledby="basic-info-heading"
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8"
      >
        <div className="mb-6">
          <h2
            id="basic-info-heading"
            className="text-base font-semibold text-gray-900 dark:text-white"
          >
            Información básica
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tu nombre y foto visibles en la plataforma
          </p>
        </div>

        <form onSubmit={handleBasicSave} className="space-y-6" noValidate>

          {/* Avatar — clicable con overlay */}
          <div className="flex items-center gap-4">
            <div
              role="button"
              tabIndex={0}
              aria-label="Cambiar foto de perfil"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              className="group/avatar relative w-20 h-20 shrink-0 rounded-full cursor-pointer
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              {/* Avatar image or initials placeholder */}
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Foto de perfil"
                  className="w-20 h-20 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-700
                             group-hover/avatar:ring-orange-400 transition-all"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full bg-brand-100 dark:bg-orange-900/30
                               text-brand-600 dark:text-orange-400 font-bold text-2xl
                               flex items-center justify-center select-none
                               ring-2 ring-gray-200 dark:ring-gray-700
                               group-hover/avatar:ring-orange-400 transition-all"
                >
                  {(name?.[0] ?? '?').toUpperCase()}
                </div>
              )}

              {/* Upload spinner (prioridad sobre hover overlay) */}
              {uploadingAvatar ? (
                <div
                  className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center pointer-events-none"
                  aria-hidden="true"
                >
                  <SpinnerIcon className="w-6 h-6 text-white animate-spin" />
                </div>
              ) : (
                /* Hover overlay — cámara + texto */
                <div
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0
                               group-hover/avatar:opacity-100 transition-opacity
                               flex flex-col items-center justify-center gap-1
                               pointer-events-none"
                  aria-hidden="true"
                >
                  <CameraIcon className="w-5 h-5 text-white" />
                  <span className="text-white text-[10px] font-semibold leading-none">
                    Cambiar
                  </span>
                </div>
              )}
            </div>

            {/* File info */}
            <div className="min-w-0" aria-live="polite">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Foto de perfil
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                JPG, PNG, WebP o GIF · Máx. 2 MB
              </p>
              {uploadingAvatar && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1">
                  <SpinnerIcon className="w-3 h-3 animate-spin shrink-0" />
                  Subiendo foto…
                </p>
              )}
              {!uploadingAvatar && avatarFile && !avatarUploadError && (
                <p className="text-xs text-brand-600 dark:text-orange-400 mt-1.5 font-medium flex items-center gap-1">
                  <CheckIcon className="w-3 h-3 shrink-0" />
                  Nueva foto lista para guardar
                </p>
              )}
              {avatarUploadError && (
                <p className="text-xs text-error-600 dark:text-red-400 mt-1.5 flex items-center gap-1">
                  <ExclamationIcon className="w-3 h-3 shrink-0" />
                  {avatarUploadError}
                  {/* Retry dispara el submit del form para reintentar upload + save */}
                  <button
                    type="submit"
                    className="ml-1 underline underline-offset-2 font-medium hover:no-underline"
                  >
                    Reintentar
                  </button>
                </p>
              )}
            </div>

            {/* Input file oculto — tabIndex=-1, aria-hidden: accesible solo via div[role=button] */}
            <input
              ref={fileInputRef}
              id="avatar-input"
              type="file"
              accept={ALLOWED_MIME_TYPES.join(',')}
              onChange={handleFileChange}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>

          {/* Nombre */}
          <InputField
            id="name"
            label="Nombre"
            value={name}
            onChange={(v) => {
              setName(v)
              setNameError(null)
              setBasicSaved(false)
            }}
            error={nameError}
            placeholder="Tu nombre completo"
            required
            maxLength={100}
            autoComplete="name"
          />

          {/* CTA único */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            {basicSaved && !isDirty && (
              <span aria-live="polite" className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mr-1">
                <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                Cambios guardados
              </span>
            )}
            <button
              type="submit"
              disabled={!isDirty || basicLoading || !nameLoaded}
              aria-busy={basicLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                         bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors focus:outline-none focus:ring-2
                         focus:ring-brand-500 focus:ring-offset-2"
            >
              {basicLoading ? (
                <>
                  <SpinnerIcon className="w-4 h-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                'Guardar cambios'
              )}
            </button>
          </div>
        </form>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          Sección 2 — Seguridad
      ══════════════════════════════════════════════════════════════ */}
      <section
        aria-labelledby="security-heading"
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8"
      >
        <div className="mb-6">
          <h2
            id="security-heading"
            className="text-base font-semibold text-gray-900 dark:text-white"
          >
            Seguridad
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cambiá tu contraseña para mantener tu cuenta protegida
          </p>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-5" noValidate>

          {/* Nueva contraseña + strength meter */}
          <div className="space-y-2">
            <InputField
              id="new-password"
              label="Nueva contraseña"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(v) => {
                setNewPassword(v)
                setPassErrors((prev) => ({ ...prev, newPwd: undefined }))
                setPassSaved(false)
              }}
              error={passErrors.newPwd}
              required
              autoComplete="new-password"
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                  aria-label={showNew ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'}
                >
                  {showNew ? (
                    <EyeSlashIcon className="w-4 h-4" />
                  ) : (
                    <EyeIcon className="w-4 h-4" />
                  )}
                </button>
              }
            />

            {/* Strength meter (solo si hay input) */}
            {newPassword.length > 0 && (
              <div className="space-y-2 pt-1">
                {/* Barras */}
                <div className="flex gap-1" aria-hidden="true">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={[
                        'h-1.5 flex-1 rounded-full transition-colors',
                        pwStrength >= level
                          ? STRENGTH_BAR_COLOR[pwStrength]
                          : 'bg-gray-200 dark:bg-gray-700',
                      ].join(' ')}
                    />
                  ))}
                </div>

                <p
                  className={`text-xs font-semibold ${STRENGTH_TEXT_COLOR[pwStrength]}`}
                  aria-live="polite"
                  aria-label={`Fortaleza de contraseña: ${STRENGTH_LABEL[pwStrength]}`}
                >
                  {STRENGTH_LABEL[pwStrength]}
                </p>

                {/* Criterios */}
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1" aria-label="Requisitos de contraseña">
                  {pwCriteria.map(({ ok, label }) => (
                    <li
                      key={label}
                      className={`flex items-center gap-1.5 text-xs transition-colors ${
                        ok
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      <CheckIcon
                        className={`w-3 h-3 shrink-0 transition-opacity ${ok ? 'opacity-100' : 'opacity-30'}`}
                      />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Confirmar contraseña */}
          <div className="space-y-1">
            <InputField
              id="confirm-password"
              label="Confirmar nueva contraseña"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(v) => {
                setConfirmPassword(v)
                setPassErrors((prev) => ({ ...prev, confirm: undefined }))
                setPassSaved(false)
              }}
              error={passErrors.confirm}
              required
              autoComplete="new-password"
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                  aria-label={showConfirm ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
                >
                  {showConfirm ? (
                    <EyeSlashIcon className="w-4 h-4" />
                  ) : (
                    <EyeIcon className="w-4 h-4" />
                  )}
                </button>
              }
            />

            {/* Match indicator en tiempo real */}
            {confirmPassword.length > 0 && !passErrors.confirm && (
              <p
                aria-live="polite"
                className={`text-xs flex items-center gap-1 pt-0.5 ${
                  confirmPassword === newPassword
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-error-500 dark:text-red-400'
                }`}
              >
                <CheckCircleIcon className="w-3 h-3 shrink-0" />
                {confirmPassword === newPassword
                  ? 'Las contraseñas coinciden'
                  : 'Las contraseñas no coinciden'}
              </p>
            )}
          </div>

          {/* CTA seguridad */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            {passSaved && (
              <span aria-live="polite" className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mr-1">
                <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                Contraseña actualizada
              </span>
            )}
            <button
              type="submit"
              disabled={passLoading || !newPassword || !confirmPassword}
              aria-busy={passLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                         border-2 border-gray-800 dark:border-gray-500
                         text-gray-800 dark:text-gray-300
                         hover:bg-gray-800 hover:text-white
                         dark:hover:bg-gray-700 dark:hover:text-white dark:hover:border-gray-700
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors focus:outline-none focus:ring-2
                         focus:ring-gray-800 dark:focus:ring-gray-500 focus:ring-offset-2"
            >
              {passLoading ? (
                <>
                  <SpinnerIcon className="w-4 h-4 animate-spin" />
                  Actualizando…
                </>
              ) : (
                'Actualizar contraseña'
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
