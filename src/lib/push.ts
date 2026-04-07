// =============================================================================
// push.ts — helper para enviar Web Push notifications con web-push
// =============================================================================

import webpush from 'web-push';
import { createLogger } from './logger';

const log = createLogger('push');

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const privateKey = process.env.VAPID_PRIVATE_KEY!;
const subject = process.env.VAPID_SUBJECT ?? 'mailto:hola@habitaplan.com';

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Envía una notificación push a una suscripción individual.
 * Devuelve true si fue exitoso, false si la suscripción expiró (410/404).
 */
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushPayload,
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
    return true;
  } catch (err: any) {
    // 410 Gone / 404 = suscripción expirada — debe eliminarse
    if (err.statusCode === 410 || err.statusCode === 404) return false;
    // Otros errores no son fatales — loguear y seguir
    log.error('Error enviando notificación push', { endpoint: subscription.endpoint, error: err });
    return true;
  }
}

/**
 * Envía a múltiples suscripciones y devuelve los endpoints expirados.
 */
export async function sendPushToMany(
  subscriptions: PushSubscriptionData[],
  payload: PushPayload,
): Promise<string[]> {
  const expiredEndpoints: string[] = [];
  await Promise.all(
    subscriptions.map(async (sub) => {
      const ok = await sendPushNotification(sub, payload);
      if (!ok) expiredEndpoints.push(sub.endpoint);
    }),
  );
  return expiredEndpoints;
}
