import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email/resend'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Enviar email de bienvenida si es la primera vez (email no confirmado previamente)
      const user = data?.user
      if (user?.email && user.email_confirmed_at) {
        const isNewConfirmation =
          new Date(user.email_confirmed_at).getTime() > Date.now() - 60_000
        if (isNewConfirmation) {
          // Fire-and-forget: no bloqueamos la redirección
          sendWelcomeEmail({
            to: user.email,
            userName: user.user_metadata?.name,
          }).catch((err) => console.error('[CALLBACK] Welcome email error:', err))
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
