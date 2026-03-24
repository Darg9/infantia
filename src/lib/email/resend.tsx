import { Resend } from 'resend';
import { WelcomeEmail } from './templates/welcome';
import { ActivityDigestEmail } from './templates/activity-digest';
import { render as renderAsync } from '@react-email/components';

const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder');

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

export interface SendWelcomeEmailParams {
  to: string;
  userName?: string;
}

export interface SendActivityDigestParams {
  to: string;
  userName?: string;
  activities: Array<{
    id: string;
    title: string;
    description?: string;
    price?: number | null;
    priceLabel: string;
    minAge?: number | null;
    maxAge?: number | null;
  }>;
  period?: 'daily' | 'weekly';
}

/**
 * Enviar email de bienvenida
 */
export async function sendWelcomeEmail({ to, userName }: SendWelcomeEmailParams) {
  try {
    const html = await renderAsync(<WelcomeEmail userEmail={userName || to} />);

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Bienvenido a Infantia 🎉',
      html,
    });

    if (result.error) {
      console.error('[EMAIL] Error enviando welcome:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log(`[EMAIL] Welcome email enviado a ${to}`);
    return { success: true, messageId: result.data?.id };
  } catch (error: any) {
    console.error('[EMAIL] Exception en sendWelcomeEmail:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Enviar digest de actividades
 */
export async function sendActivityDigest({
  to,
  userName,
  activities,
  period = 'daily',
}: SendActivityDigestParams) {
  try {
    if (activities.length === 0) {
      console.warn('[EMAIL] No hay actividades para enviar digest a', to);
      return { success: false, error: 'Sin actividades' };
    }

    const html = await renderAsync(
      <ActivityDigestEmail userName={userName || to} activities={activities} period={period} />
    );

    const periodLabel = period === 'daily' ? 'hoy' : 'esta semana';
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `${activities.length} nuevas actividades en Infantia ${periodLabel}`,
      html,
    });

    if (result.error) {
      console.error('[EMAIL] Error enviando digest:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log(`[EMAIL] Digest email enviado a ${to} (${activities.length} actividades)`);
    return { success: true, messageId: result.data?.id };
  } catch (error: any) {
    console.error('[EMAIL] Exception en sendActivityDigest:', error.message);
    return { success: false, error: error.message };
  }
}
