'use client'

// =============================================================================
// FavoriteButton — corazón toggle para guardar actividades como favoritas
// Comportamiento:
//   - Usuario autenticado: toggle optimista (POST/DELETE /api/favorites)
//   - Usuario no autenticado: redirige a /login al hacer clic
// =============================================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface FavoriteButtonProps {
  activityId: string
  initialIsFavorited: boolean
  /** Tamaño visual del botón */
  size?: 'sm' | 'md'
}

export function FavoriteButton({
  activityId,
  initialIsFavorited,
  size = 'md',
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const iconSize = size === 'sm' ? 16 : 20

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault() // evita que el link del ActivityCard se active
    e.stopPropagation()

    if (isLoading) return
    setIsLoading(true)

    // Optimistic update
    const wasLiked = isFavorited
    setIsFavorited(!wasLiked)

    try {
      let res: Response

      if (wasLiked) {
        // Eliminar favorito
        res = await fetch(`/api/favorites/${activityId}`, { method: 'DELETE' })
      } else {
        // Añadir favorito
        res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityId }),
        })
      }

      if (res.status === 401) {
        // No autenticado — revertir y redirigir a login
        setIsFavorited(wasLiked)
        router.push('/login?next=' + encodeURIComponent(`/actividades/${activityId}`))
        return
      }

      if (!res.ok) {
        // Error del servidor — revertir
        setIsFavorited(wasLiked)
      }
    } catch {
      // Error de red — revertir
      setIsFavorited(wasLiked)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      aria-label={isFavorited ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      title={isFavorited ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      className={`
        flex items-center justify-center rounded-full transition-all duration-150
        ${isLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
        ${isFavorited
          ? 'text-rose-500 hover:text-rose-400'
          : 'text-gray-300 hover:text-rose-400'
        }
      `}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill={isFavorited ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={isFavorited ? 0 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-150"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  )
}
