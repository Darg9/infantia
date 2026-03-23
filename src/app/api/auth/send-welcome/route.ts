import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email/resend'

/**
 * POST /api/auth/send-welcome
 *
 * Envía email de bienvenida después del signup
 * Llamado desde /registro después de signUp exitoso
 */
export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }

    const result = await sendWelcomeEmail({
      to: email,
      userName: name || email,
    })

    if (!result.success) {
      console.warn(`[WELCOME-EMAIL] Error enviando a ${email}:`, result.error)
      // No fallar la API si el email falla — el usuario ya se registró
      return NextResponse.json(
        { success: false, warning: result.error },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { success: true, messageId: result.messageId },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[WELCOME-EMAIL] Exception:', error.message)
    // No fallar — el signup ya sucedió
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 200 }
    )
  }
}
