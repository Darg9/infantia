'use client';
import { Button } from '@/components/ui';

// =============================================================================
// FavoriteButton — corazón toggle para guardar actividades como favoritas
// Comportamiento:
//   - Usuario autenticado: toggle optimista (POST/DELETE /api/favorites)
//   - Usuario no autenticado: redirige a /login al hacer clic
// =============================================================================

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { requireAuth } from '@/lib/require-auth'
import { toggleFavorite } from '@/modules/favorites/toggle-favorite'

interface FavoriteButtonProps {
  targetId: string
  targetType?: 'activity' | 'place'
  initialIsFavorited: boolean
  /** Tamaño visual del botón */
  size?: 'sm' | 'md'
}

export function FavoriteButton({
  targetId,
  targetType = 'activity',
  initialIsFavorited,
  size = 'md',
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()

  const iconSize = size === 'sm' ? 16 : 20

  const handleToggle = async (expectLike: boolean) => {
    if (isLoading) return
    setIsLoading(true)

    // Optimistic update
    setIsFavorited(expectLike)

    try {
      const ok = await requireAuth({
        type: 'TOGGLE_FAVORITE',
        targetId,
        targetType,
        returnTo: pathname
      }, router)

      if (!ok) {
        setIsFavorited(!expectLike)
        setIsLoading(false)
        return
      }

      const res = await toggleFavorite({ targetId, type: targetType, expectLike })

      if (!res.ok) {
        // Error del servidor — revertir
        setIsFavorited(!expectLike)
      } else {
        // Toast notifications en SUCCESS
        if (expectLike) {
          toast.success('Guardado en favoritos', {
            action: { label: 'Ver favoritos →', href: '/perfil/favoritos' }
          })
        } else {
          toast.info('Eliminado de favoritos', {
            action: { label: 'Deshacer', onClick: () => handleToggle(true) }
          })
        }
      }
    } catch {
      // Error de red — revertir
      setIsFavorited(!expectLike)
    } finally {
      setIsLoading(false)
    }
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault() // evita que el link del ActivityCard se active
    e.stopPropagation()
    handleToggle(!isFavorited)
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      aria-label={isFavorited ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      title={isFavorited ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      variant="ghost"
      size="icon"
      className={`flex items-center justify-center rounded-full transition-all duration-150 ${isLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'} ${isFavorited
          ? 'text-error-500 hover:text-error-400'
          : 'text-[var(--hp-text-muted)] hover:text-error-400'
        }`}
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
    </Button>
  );
}
