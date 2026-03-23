'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function EditarPerfilPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Name section
  const [name, setName] = useState('')
  const [nameLoaded, setNameLoaded] = useState(false)
  const [nameLoading, setNameLoading] = useState(false)
  const [nameMsg, setNameMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Avatar section
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarMsg, setAvatarMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password section
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passLoading, setPassLoading] = useState(false)
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Load user data on first render
  if (!nameLoaded) {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data }: { data: { user: { user_metadata?: Record<string, string> } | null } }) => {
      if (data.user) {
        setName(data.user.user_metadata?.name ?? '')
        if (data.user.user_metadata?.avatar_url) {
          setAvatarPreview(data.user.user_metadata.avatar_url)
        }
      }
      setNameLoaded(true)
    })
  }

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault()
    setNameMsg(null)
    setNameLoading(true)

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      if (!res.ok) {
        const data = await res.json()
        setNameMsg({ type: 'error', text: data.error ?? 'Error al actualizar nombre' })
      } else {
        setNameMsg({ type: 'success', text: 'Nombre actualizado' })
        router.refresh()
      }
    } catch {
      setNameMsg({ type: 'error', text: 'Error de conexion' })
    } finally {
      setNameLoading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setAvatarMsg({ type: 'error', text: 'El archivo es demasiado grande. Maximo 2MB.' })
      return
    }

    setAvatarFile(file)
    setAvatarMsg(null)
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleAvatarSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!avatarFile) return
    setAvatarMsg(null)
    setAvatarLoading(true)

    try {
      const formData = new FormData()
      formData.append('avatar', avatarFile)

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        setAvatarMsg({ type: 'error', text: data.error ?? 'Error al subir avatar' })
      } else {
        setAvatarMsg({ type: 'success', text: 'Avatar actualizado' })
        setAvatarFile(null)
        router.refresh()
      }
    } catch {
      setAvatarMsg({ type: 'error', text: 'Error de conexion' })
    } finally {
      setAvatarLoading(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPassMsg(null)

    if (newPassword.length < 6) {
      setPassMsg({ type: 'error', text: 'La nueva contrasena debe tener al menos 6 caracteres' })
      return
    }

    if (newPassword !== confirmPassword) {
      setPassMsg({ type: 'error', text: 'Las contrasenas no coinciden' })
      return
    }

    setPassLoading(true)

    try {
      const supabase = createSupabaseBrowserClient()

      // Verify current password
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user?.email) {
        setPassMsg({ type: 'error', text: 'No se pudo obtener el email del usuario' })
        setPassLoading(false)
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: currentPassword,
      })

      if (signInError) {
        setPassMsg({ type: 'error', text: 'La contrasena actual es incorrecta' })
        setPassLoading(false)
        return
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setPassMsg({ type: 'error', text: updateError.message })
      } else {
        setPassMsg({ type: 'success', text: 'Contrasena actualizada' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch {
      setPassMsg({ type: 'error', text: 'Error al cambiar contrasena' })
    } finally {
      setPassLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Editar perfil</h1>

      {/* Name section */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Nombre</h2>
        <form onSubmit={handleNameSubmit} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Tu nombre"
          />
          {nameMsg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${
              nameMsg.type === 'success'
                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                : 'text-red-600 bg-red-50 border border-red-200'
            }`}>
              {nameMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={nameLoading}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
          >
            {nameLoading ? 'Guardando...' : 'Guardar nombre'}
          </button>
        </form>
      </section>

      {/* Avatar section */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Foto de perfil</h2>
        <form onSubmit={handleAvatarSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar"
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-xl">
                {(name?.[0] ?? '?').toUpperCase()}
              </div>
            )}
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium"
              >
                Cambiar foto
              </button>
              <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WebP o GIF. Max 2MB.</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />
          {avatarMsg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${
              avatarMsg.type === 'success'
                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                : 'text-red-600 bg-red-50 border border-red-200'
            }`}>
              {avatarMsg.text}
            </p>
          )}
          {avatarFile && (
            <button
              type="submit"
              disabled={avatarLoading}
              className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
            >
              {avatarLoading ? 'Subiendo...' : 'Guardar foto'}
            </button>
          )}
        </form>
      </section>

      {/* Password section */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Cambiar contrasena</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Contrasena actual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nueva contrasena</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Confirmar nueva contrasena</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          {passMsg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${
              passMsg.type === 'success'
                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                : 'text-red-600 bg-red-50 border border-red-200'
            }`}>
              {passMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={passLoading}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
          >
            {passLoading ? 'Cambiando...' : 'Cambiar contrasena'}
          </button>
        </form>
      </section>
    </div>
  )
}
