import { Button } from "@/components/ui/button";
'use client'

import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <Button
      onClick={handleLogout}
      className="text-sm text-[var(--hp-text-secondary)] hover:text-error-600 transition-colors"
    >Salir
          </Button>
  );
}
