'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Dropdown, Avatar } from '@/components/ui'

interface UserMenuProps {
  email: string
  avatarUrl?: string
  isAdmin?: boolean
  providerSlug?: string | null
}

export function UserMenu({ email, avatarUrl, isAdmin, providerSlug }: UserMenuProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const initial = (email?.[0] ?? '?').toUpperCase()

  return (
    <Dropdown>
      <Dropdown.Trigger>
        <Avatar src={avatarUrl} name={initial} size="sm" />
      </Dropdown.Trigger>
      
      <Dropdown.Menu className="w-48">
        {isAdmin && (
          <Link href="/admin" tabIndex={-1}>
            <Dropdown.Item className="text-brand-600 font-medium hover:text-brand-700">
              Admin
            </Dropdown.Item>
          </Link>
        )}
        {providerSlug && (
          <Link href={`/proveedores/${providerSlug}/dashboard`} tabIndex={-1}>
            <Dropdown.Item className="text-indigo-600 font-medium hover:text-indigo-700">
              Panel
            </Dropdown.Item>
          </Link>
        )}

        <Link href="/perfil" tabIndex={-1}>
          <Dropdown.Item>Cuenta</Dropdown.Item>
        </Link>
        <Link href="/perfil/favoritos" tabIndex={-1}>
          <Dropdown.Item>Favoritos</Dropdown.Item>
        </Link>

        <Dropdown.Divider />
        <Dropdown.Item onClick={handleLogout} danger>
          Salir
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )
}
