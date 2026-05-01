import { getErrorMessage } from '../../../../lib/error';
import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email/resend'
import { createLogger } from '@/lib/logger';

const log = createLogger('api:send-welcome');

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
      log.warn('Error enviando welcome email', { email, error: result.error })
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
  } catch (error: unknown) {
    log.error('Exception en send-welcome', { error })
    // No fallar — el signup ya sucedió
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 200 }
    )
  }
}
