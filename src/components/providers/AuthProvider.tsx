'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      router.refresh()
    })

    return () => subscription.unsubscribe()
  }, [router])

  return <>{children}</>
}
