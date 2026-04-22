import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email/resend'
import { getOrCreateDbUser } from '@/lib/auth'
import { createLogger } from '@/lib/logger';

const log = createLogger('auth:callback');

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data?.user) {
      const user = data.user
      let dbUser;
      
      try {
        dbUser = await getOrCreateDbUser(user)
      } catch (err) {
        log.error('User upsert error', { error: err, userId: user.id })
        return NextResponse.redirect(`${origin}/login?error=sync_failed`)
      }

      // Enviar email de bienvenida si es la primera confirmación y tiene email
      let isNewUser = false
      if (user.email && user.email_confirmed_at) {
        isNewUser = new Date(user.email_confirmed_at).getTime() > Date.now() - 60_000
        if (isNewUser) {
          sendWelcomeEmail({
            to: user.email,
            userName: user.user_metadata?.name,
          }).catch((err) => log.error('Welcome email error', { error: err, email: user.email }))
        }
      }

      if (!dbUser.termsAcceptedAt) {
        return NextResponse.redirect(`${origin}/auth/terminos?next=${encodeURIComponent(next)}`)
      }

      // Nuevos usuarios van al onboarding si no van a otra ruta
      const redirectPath = isNewUser && next === '/' ? '/onboarding' : next
      return NextResponse.redirect(`${origin}${redirectPath}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
