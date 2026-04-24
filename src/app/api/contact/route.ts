// =============================================================================
// POST /api/contact — Formulario de contacto
// Envía el mensaje a info@habitaplan.com via Resend
// + auto-respuesta al usuario confirmando recepción
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createLogger } from '@/lib/logger';

const log    = createLogger('api:contact');
const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder');

const FROM_EMAIL    = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const CONTACT_EMAIL = 'info@habitaplan.com';

const CATEGORY_LABELS: Record<string, string> = {
  general: 'Consulta general',
  content_removal: 'Solicitud de remoción de contenido',
  data_access: 'Derechos de datos personales (consulta)',
  data_claim: 'Derechos de datos personales (reclamo)',
  report_error: 'Reportar información incorrecta',
  other: 'Otro',
};

const DATA_RIGHT_LABELS: Record<string, string> = {
  access: 'Acceso',
  update: 'Actualización',
  rectification: 'Rectificación',
  deletion: 'Supresión',
  revocation: 'Revocatoria',
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }

  const { category, tipoDerecho, nombre, email, mensaje, actividadUrl } = body as Record<string, string>;

  // Validaciones
  if (!category || !CATEGORY_LABELS[category]) {
    return NextResponse.json({ error: 'Motivo inválido' }, { status: 400 });
  }

  if (['data_access', 'data_claim'].includes(category) && !tipoDerecho) {
    return NextResponse.json({ error: 'Falta especificar el tipo de derecho solicitado' }, { status: 400 });
  }

  // Nombre es opcional, default a 'Usuario'
  const nombreClean = nombre?.trim() || 'Usuario';

  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: 'Correo electrónico inválido' }, { status: 400 });
  }
  
  if (!mensaje?.trim() || mensaje.trim().length < 10) {
    return NextResponse.json({ error: 'El mensaje debe tener al menos 10 caracteres' }, { status: 400 });
  }

  const emailClean   = email.trim().toLowerCase();
  const mensajeClean = mensaje.trim();
  const urlClean     = actividadUrl?.trim() || '';

  const motivoLegible = CATEGORY_LABELS[category];
  const derechoLegible = tipoDerecho ? DATA_RIGHT_LABELS[tipoDerecho] || tipoDerecho : null;

  // ── Email al equipo HabitaPlan ─────────────────────────────────────────────
  const htmlEquipo = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
      <h2 style="color:#ea580c;margin-bottom:4px">Nuevo mensaje de contacto</h2>
      <p style="color:#666;margin-top:0;font-size:14px">${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })} COL</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr style="background:#f9f9f9">
          <td style="padding:8px 12px;font-weight:600;width:160px;border:1px solid #eee">Motivo</td>
          <td style="padding:8px 12px;border:1px solid #eee">${motivoLegible}</td>
        </tr>
        ${derechoLegible ? `
        <tr>
          <td style="padding:8px 12px;font-weight:600;border:1px solid #eee">Tipo de Derecho</td>
          <td style="padding:8px 12px;border:1px solid #eee">${derechoLegible}</td>
        </tr>` : ''}
        <tr style="background:#f9f9f9">
          <td style="padding:8px 12px;font-weight:600;border:1px solid #eee">Nombre</td>
          <td style="padding:8px 12px;border:1px solid #eee">${nombreClean}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;font-weight:600;border:1px solid #eee">Correo</td>
          <td style="padding:8px 12px;border:1px solid #eee">
            <a href="mailto:${emailClean}" style="color:#ea580c">${emailClean}</a>
          </td>
        </tr>
        ${urlClean ? `
        <tr style="background:#f9f9f9">
          <td style="padding:8px 12px;font-weight:600;border:1px solid #eee">URL actividad</td>
          <td style="padding:8px 12px;border:1px solid #eee">
            <a href="${urlClean}" style="color:#ea580c">${urlClean}</a>
          </td>
        </tr>` : ''}
        <tr>
          <td style="padding:8px 12px;font-weight:600;border:1px solid #eee;vertical-align:top">Mensaje</td>
          <td style="padding:8px 12px;border:1px solid #eee;white-space:pre-wrap">${mensajeClean}</td>
        </tr>
      </table>
      <p style="font-size:12px;color:#999">
        Puedes responder directamente a este correo — el Reply-To está configurado al remitente.
      </p>
    </div>
  `;

  // ── Auto-respuesta al usuario ──────────────────────────────────────────────
  const htmlUser = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
      <h2 style="color:#ea580c">Recibimos tu mensaje</h2>
      <p>Hola <strong>${nombreClean}</strong>,</p>
      <p>Hemos recibido tu solicitud de contacto con el motivo <strong>${motivoLegible}</strong>. Te responderemos dentro de los plazos establecidos según el tipo de solicitud.</p>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:16px 0;font-size:14px">
        <p style="margin:0 0 8px;font-weight:600;color:#c2410c">Tu mensaje:</p>
        <p style="margin:0;white-space:pre-wrap;color:#374151">${mensajeClean}</p>
      </div>
      <p style="font-size:13px;color:#666">
        Si necesitas agregar información, responde a este correo.<br>
        No compartas datos sensibles por este medio.
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="font-size:12px;color:#999;margin:0">
        HabitaPlan — Actividades para niños y familias en Colombia<br>
        <a href="https://habitaplan.com" style="color:#ea580c">habitaplan.com</a>
      </p>
    </div>
  `;

  try {
    // Enviar ambos emails en paralelo
    const [resEquipo, resUser] = await Promise.all([
      resend.emails.send({
        from:     FROM_EMAIL,
        to:       CONTACT_EMAIL,
        replyTo:  emailClean,
        subject:  `[Contacto] ${motivoLegible} — ${nombreClean}`,
        html:     htmlEquipo,
      }),
      resend.emails.send({
        from:    FROM_EMAIL,
        to:      emailClean,
        subject: 'Recibimos tu mensaje — HabitaPlan',
        html:    htmlUser,
      }),
    ]);

    if (resEquipo.error) {
      log.error('Error enviando email equipo', { error: resEquipo.error, category });
      return NextResponse.json({ error: 'Error al enviar. Intenta de nuevo o escríbenos a info@habitaplan.com' }, { status: 500 });
    }

    log.info('Contacto recibido', { category, email: emailClean, tipoDerecho });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    log.error('Exception en /api/contact', { error: msg });
    return NextResponse.json({ error: 'Error al enviar. Intenta de nuevo.' }, { status: 500 });
  }
}
