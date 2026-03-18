'use client'

import { useState, useEffect } from 'react'

interface ShareButtonProps {
  id: string
  title: string
  description: string
  imageUrl?: string | null
  ageMin?: number | null
  ageMax?: number | null
}

export function ShareButton({
  id,
  title,
  description,
  imageUrl,
  ageMin,
  ageMax,
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [supportsWebShare, setSupportsWebShare] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setSupportsWebShare(!!navigator.share)
  }, [])

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://infantia.co'

  const ageLabel =
    ageMin && ageMax
      ? `${ageMin}–${ageMax} años`
      : ageMin
        ? `Desde ${ageMin} años`
        : ageMax
          ? `Hasta ${ageMax} años`
          : 'Todas las edades'

  const shareText = `${title} — ${ageLabel} · Descubre más en Infantia`
  const shareUrl = `${SITE_URL}/actividades/${id}`

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: shareText,
          url: shareUrl,
          ...(imageUrl && { files: [] }), // OG meta tags serán usados por el navegador
        })
      } catch (err) {
        // Usuario canceló el share
        if ((err as Error).name !== 'AbortError') {
          console.error('Error compartiendo:', err)
        }
      }
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      alert('No se pudo copiar al portapapeles')
      console.error(err)
    }
  }

  const shareLinks = [
    {
      name: 'WhatsApp',
      icon: '💬',
      url: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
    },
    {
      name: 'Facebook',
      icon: 'f',
      url: `https://facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Twitter',
      icon: '𝕏',
      url: `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Telegram',
      icon: '✈️',
      url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'Email',
      icon: '✉️',
      url: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
    },
    {
      name: 'LinkedIn',
      icon: 'in',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Instagram',
      icon: '📷',
      url: 'https://instagram.com/',
      onClick: copyToClipboard,
    },
    {
      name: 'TikTok',
      icon: '🎵',
      url: 'https://www.tiktok.com/',
      onClick: copyToClipboard,
    },
  ]

  if (supportsWebShare) {
    return (
      <button
        onClick={handleWebShare}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-orange-100 px-4 py-2.5 text-sm font-medium text-orange-600 hover:bg-orange-200 transition-colors"
      >
        <span>📤</span>
        Compartir
      </button>
    )
  }

  return (
    <div className="relative w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-orange-100 px-4 py-2.5 text-sm font-medium text-orange-600 hover:bg-orange-200 transition-colors"
      >
        <span>📤</span>
        Compartir
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg z-50">
          {/* Copiar vínculo (siempre al inicio) */}
          <button
            onClick={() => {
              copyToClipboard()
              setIsOpen(false)
            }}
            className={`w-full px-4 py-2.5 text-left text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors border-b border-gray-100 ${copied ? 'text-green-600' : 'text-gray-700'}`}
          >
            <span>{copied ? '✓' : '🔗'}</span>
            {copied ? 'Vínculo copiado' : 'Copiar vínculo'}
          </button>

          {/* Redes sociales en grid 2 columnas */}
          <div className="grid grid-cols-2 gap-0">
            {shareLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => {
                  if (link.onClick) {
                    link.onClick()
                  } else {
                    window.open(link.url, '_blank', 'noopener,noreferrer')
                  }
                  setIsOpen(false)
                }}
                className="px-3 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors border-r border-b border-gray-100 last:border-r-0 flex items-center gap-1.5 justify-center"
              >
                <span>{link.icon}</span>
                <span className="hidden sm:inline">{link.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Overlay para cerrar dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
