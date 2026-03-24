'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface UserMenuProps {
  email: string
  avatarUrl?: string
  isAdmin?: boolean
}

export function UserMenu({ email, avatarUrl, isAdmin }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const initial = (email?.[0] ?? '?').toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        aria-label="Menú de usuario"
        aria-expanded={open}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-semibold">
            {initial}
          </div>
        )}
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-xl bg-white border border-gray-100 shadow-lg py-1 z-50">
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-orange-600 font-medium hover:bg-orange-50 transition-colors"
            >
              Admin
            </Link>
          )}
          <Link
            href="/perfil"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Mi perfil
          </Link>
          <Link
            href="/perfil/favoritos"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Mis favoritos
          </Link>
          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            Salir
          </button>
        </div>
      )}
    </div>
  )
}
