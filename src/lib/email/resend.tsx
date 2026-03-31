import { Resend } from 'resend';
import { WelcomeEmail } from './templates/welcome';
import { ActivityDigestEmail } from './templates/activity-digest';
import { render as renderAsync } from '@react-email/components';
import { createLogger } from '@/lib/logger';

const log = createLogger('email');

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
      log.error('Error enviando welcome', { to, error: result.error });
      return { success: false, error: result.error.message };
    }

    log.info('Welcome email enviado', { to });
    return { success: true, messageId: result.data?.id };
  } catch (error: any) {
    log.error('Exception en sendWelcomeEmail', { to, error });
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
      log.warn('Sin actividades para digest', { to });
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
      log.error('Error enviando digest', { to, error: result.error });
      return { success: false, error: result.error.message };
    }

    log.info('Digest email enviado', { to, count: activities.length });
    return { success: true, messageId: result.data?.id };
  } catch (error: any) {
    log.error('Exception en sendActivityDigest', { to, error });
    return { success: false, error: error.message };
  }
}
