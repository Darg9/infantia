import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email/resend'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger';

const log = createLogger('auth:callback');

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const user = data?.user
      if (user) {
        // Upsert en la tabla users — cubre email/password y Google OAuth
        const name =
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email?.split('@')[0] ??
          'Usuario'
        await prisma.user.upsert({
          where: { supabaseAuthId: user.id },
          create: {
            supabaseAuthId: user.id,
            email: user.email ?? '',
            name,
            role: 'PARENT',
          },
          update: {},
        }).catch((err) => log.error('User upsert error', { error: err, userId: user.id }))

        // Enviar email de bienvenida si es la primera confirmación
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

        // Nuevos usuarios van al onboarding
        const redirectPath = isNewUser ? '/onboarding' : next
        return NextResponse.redirect(`${origin}${redirectPath}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
