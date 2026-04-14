// GET /api/test-email
// Endpoint TEMPORAL para validar SPF, DKIM y DMARC con Resend.
// ⚠️ ABIERTO TEMPORALMENTE - Eliminar este archivo después de validar.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createLogger } from '@/lib/logger';

const log = createLogger('test-email');


const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = process.env.RESEND_FROM_EMAIL ?? 'HabitaPlan <notificaciones@habitaplan.com>';

/**
 * GET /api/admin/test-email?to=tuemail@gmail.com
 *
 * Envía un email de prueba para validar SPF, DKIM y DMARC.
 * Tras recibirlo en Gmail → ⋮ → "Mostrar original" y verificar:
 *   SPF:   PASS  (con domain habitaplan.com)
 *   DKIM:  PASS  (con domain habitaplan.com)
 *   DMARC: PASS
 */
export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get('to');

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json(
      { error: 'Parámetro ?to= requerido. Ejemplo: ?to=tuemail@gmail.com' },
      { status: 400 }
    );
  }

  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'placeholder') {
    return NextResponse.json(
      { error: 'RESEND_API_KEY no configurado' },
      { status: 500 }
    );
  }

  log.info('Enviando email de prueba DMARC', { to, from: FROM });

  try {
    const result = await resend.emails.send({
      from:    FROM,
      to:      [to],
      subject: '✅ Test SPF DKIM DMARC — HabitaPlan',
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
          <h2 style="color:#ea580c">Prueba de autenticación de dominio</h2>
          <p>Si recibes este correo, el envío Resend funciona.</p>
          <p>Para validar SPF, DKIM y DMARC:</p>
          <ol>
            <li>Abre este email en <strong>Gmail</strong></li>
            <li>Click en <strong>⋮ → Mostrar original</strong></li>
            <li>Verifica que aparezca:</li>
          </ol>
          <pre style="background:#f4f4f4;padding:12px;border-radius:6px;font-size:13px">SPF:   PASS  with domain habitaplan.com
DKIM:  PASS  with domain habitaplan.com
DMARC: PASS</pre>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="font-size:12px;color:#999">
            HabitaPlan — Endpoint temporal de validación<br>
            FROM: ${FROM}<br>
            Enviado: ${new Date().toISOString()}
          </p>
        </div>
      `,
    });

    if (result.error) {
      log.error('Error Resend', { error: result.error, to });
      return NextResponse.json(
        { success: false, error: result.error.message, code: result.error.name },
        { status: 500 }
      );
    }

    log.info('Email de prueba enviado OK', { messageId: result.data?.id, to });

    return NextResponse.json({
      success:   true,
      messageId: result.data?.id,
      to,
      from:      FROM,
      nextStep:  'Abre el email en Gmail → ⋮ → Mostrar original → verificar SPF/DKIM/DMARC: PASS',
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    log.error('Exception en test-email', { error: msg });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
