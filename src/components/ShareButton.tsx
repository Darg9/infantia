'use client';
import { Button } from "@/components/ui/button";

import { useState, useEffect } from 'react'
import { SITE_URL } from '@/config/site'
import { activityPath } from '@/lib/activity-url'
import { createLogger } from '@/lib/logger';
import { useToast } from '@/components/ui/toast';

const log = createLogger('share-button');

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
  const { toast } = useToast()

  useEffect(() => {
    setSupportsWebShare(!!navigator.share)
  }, [])

  const ageLabel =
    ageMin != null && ageMax != null
      ? `${ageMin}–${ageMax} años`
      : ageMin != null
        ? `Desde ${ageMin} años`
        : ageMax != null
          ? `Hasta ${ageMax} años`
          : 'Todas las edades'

  const shareText = `${title} — ${ageLabel} · Descubre más en HabitaPlan`
  const shareUrl = `${SITE_URL}${activityPath(id, title)}`

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
          log.error('Error compartiendo', { error: err })
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
      toast.error('No se pudo copiar al portapapeles')
      log.error(String(err), { error: err })
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
      <Button
        onClick={handleWebShare}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-100 px-4 py-2.5 text-sm font-medium text-brand-600 hover:bg-brand-200 transition-colors"
      >
        <span>📤</span>Compartir
              </Button>
    );
  }

  return (
    <div className="relative w-full">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-100 px-4 py-2.5 text-sm font-medium text-brand-600 hover:bg-brand-200 transition-colors"
      >
        <span>📤</span>
        Compartir
      </Button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] shadow-lg z-50">
          {/* Copiar vínculo (siempre al inicio) */}
          <Button
            onClick={() => {
              copyToClipboard()
              setIsOpen(false)
            }}
            className={`w-full px-4 py-2.5 text-left text-sm font-medium flex items-center gap-2 hover:bg-[var(--hp-bg-page)] transition-colors border-b border-[var(--hp-border)] ${copied ? 'text-success-600' : 'text-[var(--hp-text-primary)]'}`}
          >
            <span>{copied ? '✓' : '🔗'}</span>
            {copied ? 'Vínculo copiado' : 'Copiar vínculo'}
          </Button>

          {/* Redes sociales en grid 2 columnas */}
          <div className="grid grid-cols-2 gap-0">
            {shareLinks.map((link) => (
              <Button
                key={link.name}
                onClick={() => {
                  if (link.onClick) {
                    link.onClick()
                  } else {
                    window.open(link.url, '_blank', 'noopener,noreferrer')
                  }
                  setIsOpen(false)
                }}
                className="px-3 py-2.5 text-xs font-medium text-gray-600 hover:bg-[var(--hp-bg-page)] transition-colors border-r border-b border-[var(--hp-border)] last:border-r-0 flex items-center gap-1.5 justify-center"
              >
                <span>{link.icon}</span>
                <span className="hidden sm:inline">{link.name}</span>
              </Button>
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
  );
}
