import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { Intent, IntentManager } from './intent-manager'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

/**
 * Ensures user is authenticated. 
 * If not, saves the Intent context and redirects to /login.
 */
export async function requireAuth(intent: Intent, router: AppRouterInstance): Promise<boolean> {
  const supabase = createSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    IntentManager.save(intent)
    router.push('/login')
    return false
  }

  return true
}
