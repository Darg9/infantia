import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { PQRS_SLA } from '@/lib/pqrs';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const log = createLogger('api:check-overdue-pqrs');

const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder');
const FROM_EMAIL  = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const ADMIN_EMAIL = 'info@habitaplan.com';

// ---------------------------------------------------------------------------
// Días hábiles (lun–vie, sin festivos colombianos)
// Para precisión 100% legal ante la SIC se necesitaría una API de festivos.
// ---------------------------------------------------------------------------
function getBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const cur = new Date(startDate.getTime());
  cur.setHours(0, 0, 0, 0);
  const end = new Date(endDate.getTime());
  end.setHours(0, 0, 0, 0);

  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(0, count - 1);
}

// ---------------------------------------------------------------------------
// Clasificación por SLA — fuente de verdad: src/lib/pqrs.ts › PQRS_SLA
// ---------------------------------------------------------------------------
type AlertLevel = 'WARNING' | 'DUE_TODAY' | 'OVERDUE';

interface PqrsAlert {
  id: string;
  createdAt: string;      // ISO date
  category: string;
  status: string;
  email: string;
  businessDays: number;
  limit: number;
  level: AlertLevel;
}

function classify(
  businessDays: number,
  category: string,
): { level: AlertLevel | null; limit: number } {
  const sla = PQRS_SLA[category as keyof typeof PQRS_SLA] ?? PQRS_SLA.general;
  const { alertAt, limit } = sla;

  if (businessDays > limit)    return { level: 'OVERDUE',   limit };
  if (businessDays === limit)  return { level: 'DUE_TODAY', limit };
  if (businessDays >= alertAt) return { level: 'WARNING',   limit };
  return { level: null, limit };
}

// ---------------------------------------------------------------------------
// Email HTML
// ---------------------------------------------------------------------------
function buildEmailHtml(alerts: PqrsAlert[]): string {
  const overdueCount  = alerts.filter(a => a.level === 'OVERDUE').length;
  const dueTodayCount = alerts.filter(a => a.level === 'DUE_TODAY').length;
  const warningCount  = alerts.filter(a => a.level === 'WARNING').length;

  const emoji = overdueCount > 0 ? '🚨' : dueTodayCount > 0 ? '⏱️' : '⚠️';
  const subject = `${emoji} HabitaPlan — PQRS requieren atención (${alerts.length} casos)`;

  const rows = alerts
    .map(a => {
      const color = a.level === 'OVERDUE' ? '#c0392b' : a.level === 'DUE_TODAY' ? '#e67e22' : '#f39c12';
      const label = a.level === 'OVERDUE' ? '🚨 VENCIDO' : a.level === 'DUE_TODAY' ? '⏱️ VENCE HOY' : '⚠️ ADVERTENCIA';
      return `
        <tr>
          <td style="padding:6px 8px;border:1px solid #ddd;font-family:monospace">${a.id.slice(0, 8)}</td>
          <td style="padding:6px 8px;border:1px solid #ddd">${a.createdAt}</td>
          <td style="padding:6px 8px;border:1px solid #ddd">${a.category}</td>
          <td style="padding:6px 8px;border:1px solid #ddd">${a.status}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${a.businessDays}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${a.limit}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;font-weight:bold;color:${color}">${label}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px">${a.email}</td>
        </tr>`;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;color:#222;max-width:900px;margin:0 auto;padding:20px">
  <h2 style="color:#c0392b">${emoji} Alerta PQRS — HabitaPlan</h2>
  <p>Se encontraron <strong>${alerts.length}</strong> solicitudes que requieren atención inmediata:</p>
  <ul>
    ${overdueCount  > 0 ? `<li>🚨 <strong>${overdueCount}</strong> vencidas</li>` : ''}
    ${dueTodayCount > 0 ? `<li>⏱️ <strong>${dueTodayCount}</strong> vencen hoy</li>` : ''}
    ${warningCount  > 0 ? `<li>⚠️ <strong>${warningCount}</strong> en zona de advertencia</li>` : ''}
  </ul>
  <table style="border-collapse:collapse;width:100%;font-size:13px">
    <thead>
      <tr style="background:#f5f5f5">
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">ID</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Creado</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Categoría</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Estado</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:center">Días Háb.</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:center">Límite</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Nivel</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Email</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <hr style="margin-top:24px">
  <p style="font-size:12px;color:#888">
    Este es un aviso automático de HabitaPlan para cumplimiento SIC (Ley 1581).<br>
    Genera este reporte: <code>GET /api/admin/check-overdue-pqrs</code>
  </p>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// GET handler (invocado por Vercel Cron, lunes–viernes 8am)
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  log.info('Iniciando revisión de PQRS vencidas (Ley 1581)...');
  const now = new Date();

  try {
    const openRequests = await prisma.contactRequest.findMany({
      where: { status: { not: 'closed' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true, category: true, status: true, email: true },
    });

    const alerts: PqrsAlert[] = [];

    for (const req of openRequests) {
      const businessDays = getBusinessDays(req.createdAt, now);
      const { level, limit } = classify(businessDays, req.category);
      if (!level) continue;

      alerts.push({
        id: req.id,
        createdAt: req.createdAt.toISOString().split('T')[0],
        category: req.category,
        status: req.status,
        email: req.email,
        businessDays,
        limit,
        level,
      });
    }

    const overdueCount  = alerts.filter(a => a.level === 'OVERDUE').length;
    const dueTodayCount = alerts.filter(a => a.level === 'DUE_TODAY').length;
    const warningCount  = alerts.filter(a => a.level === 'WARNING').length;

    log.info('Revisión PQRS completada', {
      open: openRequests.length,
      overdue: overdueCount,
      dueToday: dueTodayCount,
      warning: warningCount,
    });

    // Null-fire: solo envía email si hay al menos un caso que requiera atención
    if (alerts.length === 0) {
      log.info('Todo al día. No hay PQRS vencidas ni en riesgo.');
      return NextResponse.json({ success: true, sent: false, stats: { open: openRequests.length, alerts: 0 } });
    }

    const emoji = overdueCount > 0 ? '🚨' : dueTodayCount > 0 ? '⏱️' : '⚠️';
    const subject = `${emoji} HabitaPlan — PQRS requieren atención (${alerts.length} casos)`;
    const html = buildEmailHtml(alerts);

    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject,
      html,
    });

    if (sendError) {
      log.error('Error enviando alerta PQRS por email', { error: sendError.message });
      return NextResponse.json(
        { error: 'DB OK pero fallo al enviar email', detail: sendError.message },
        { status: 500 },
      );
    }

    log.warn(`Alerta PQRS enviada a ${ADMIN_EMAIL}`, { overdue: overdueCount, dueToday: dueTodayCount, warning: warningCount });

    return NextResponse.json({
      success: true,
      sent: true,
      to: ADMIN_EMAIL,
      stats: { open: openRequests.length, overdue: overdueCount, dueToday: dueTodayCount, warning: warningCount },
    });

  } catch (error) {
    log.error('Error en check-overdue-pqrs', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Fallo interno' }, { status: 500 });
  }
}
