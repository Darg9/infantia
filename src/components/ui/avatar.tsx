/**
 * Avatar — HabitaPlan Design System
 *
 * Variantes de uso:
 *   <Avatar name="María" size="md" />                        — placeholder inicial
 *   <Avatar src={url} name="María" size="lg" />              — con imagen
 *   <Avatar src={url} name="María" uploading={true} />       — spinner durante upload
 *   <Avatar src={url} name="María" editable onClick={fn} />  — con overlay "Cambiar"
 *
 * Tamaños: xs (24) / sm (32) / md (40) / lg (64) / xl (80)
 */

import { clsx } from 'clsx'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps {
  name?: string
  src?: string | null
  size?: AvatarSize
  /** Muestra spinner de carga encima (durante upload) */
  uploading?: boolean
  /** Activa el overlay "Cambiar foto" al hover — requiere onClick */
  editable?: boolean
  onClick?: () => void
  className?: string
}

const SIZE_CLASSES: Record<AvatarSize, { wrapper: string; text: string; icon: string }> = {
  xs: { wrapper: 'w-6 h-6',   text: 'text-[10px]', icon: 'w-3 h-3' },
  sm: { wrapper: 'w-8 h-8',   text: 'text-xs',     icon: 'w-3.5 h-3.5' },
  md: { wrapper: 'w-10 h-10', text: 'text-sm',     icon: 'w-4 h-4' },
  lg: { wrapper: 'w-16 h-16', text: 'text-lg',     icon: 'w-5 h-5' },
  xl: { wrapper: 'w-20 h-20', text: 'text-2xl',    icon: 'w-6 h-6' },
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('animate-spin', className)} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
    </svg>
  )
}

export function Avatar({
  name,
  src,
  size = 'md',
  uploading = false,
  editable = false,
  onClick,
  className,
}: AvatarProps) {
  const { wrapper, text, icon } = SIZE_CLASSES[size]
  const initial = (name?.[0] ?? '?').toUpperCase()
  const isInteractive = editable && !!onClick

  const content = (
    <>
      {/* Image or initial */}
      {src ? (
        <img
          src={src}
          alt={name ? `Foto de ${name}` : 'Avatar'}
          className={clsx(
            wrapper,
            'rounded-full object-cover',
            'ring-2 ring-[var(--hp-border)] ring-[var(--hp-border)]',
            isInteractive && 'group-hover/avatar:ring-brand-400 transition-all'
          )}
        />
      ) : (
        <div
          className={clsx(
            wrapper,
            'rounded-full flex items-center justify-center font-bold select-none',
            'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400',
            'ring-2 ring-[var(--hp-border)] ring-[var(--hp-border)]',
            isInteractive && 'group-hover/avatar:ring-brand-400 transition-all',
            text
          )}
        >
          {initial}
        </div>
      )}

      {/* Upload spinner overlay */}
      {uploading && (
        <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center pointer-events-none">
          <SpinnerIcon className={clsx('text-white', icon)} />
        </div>
      )}

      {/* Editable hover overlay */}
      {isInteractive && !uploading && (
        <div
          className='absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 pointer-events-none'
        >
          <CameraIcon className={clsx('text-white', icon)} />
          {size !== 'xs' && size !== 'sm' && (
            <span className="text-white text-[10px] font-semibold leading-none">
              Cambiar
            </span>
          )}
        </div>
      )}
    </>
  )

  if (isInteractive) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label="Cambiar foto de perfil"
        aria-busy={uploading}
        onClick={onClick}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
        className={clsx(
          'group/avatar relative shrink-0 rounded-full cursor-pointer',
          wrapper,
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
          className
        )}
      >
        {content}
      </div>
    )
  }

  return (
    <div className={clsx('relative shrink-0', wrapper, className)} aria-busy={uploading}>
      {content}
    </div>
  )
}
