// =============================================================================
// Tests para lib/push.ts
// Cubre: sendPushNotification (éxito, 410, 404, error no fatal),
//        sendPushToMany (endpoints expirados, vacío, mixto)
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock web-push ─────────────────────────────────────────────────────────────
const mockSendNotification = vi.fn();
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}));

// Configurar vars de entorno para que setVapidDetails se llame en init
vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'fake-public-key');
vi.stubEnv('VAPID_PRIVATE_KEY', 'fake-private-key');
vi.stubEnv('VAPID_SUBJECT', 'mailto:test@habitaplan.com');

// Import después de mocks
import { sendPushNotification, sendPushToMany } from '../push';
import type { PushSubscriptionData, PushPayload } from '../push';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const subscription: PushSubscriptionData = {
  endpoint: 'https://push.example.com/sub/abc123',
  p256dh: 'fake-p256dh-key',
  auth: 'fake-auth-secret',
};

const payload: PushPayload = {
  title: 'Nueva actividad',
  body: 'Teatro para niños en Virgilio Barco',
  url: '/actividades/abc123',
  tag: 'new-activity',
};

// Helper: error con statusCode (como los lanza web-push)
function webPushError(statusCode: number) {
  const err = Object.assign(new Error(`Push error ${statusCode}`), { statusCode });
  return err;
}

describe('sendPushNotification()', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('envío exitoso', () => {
    it('retorna true cuando sendNotification resuelve', async () => {
      mockSendNotification.mockResolvedValue({ statusCode: 201 });

      const result = await sendPushNotification(subscription, payload);

      expect(result).toBe(true);
    });

    it('llama a sendNotification con el endpoint y keys correctos', async () => {
      mockSendNotification.mockResolvedValue({});

      await sendPushNotification(subscription, payload);

      expect(mockSendNotification).toHaveBeenCalledWith(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        expect.any(String),
      );
    });

    it('serializa el payload como JSON string', async () => {
      mockSendNotification.mockResolvedValue({});

      await sendPushNotification(subscription, payload);

      const payloadArg = mockSendNotification.mock.calls[0][1];
      const parsed = JSON.parse(payloadArg);
      expect(parsed.title).toBe(payload.title);
      expect(parsed.body).toBe(payload.body);
      expect(parsed.url).toBe(payload.url);
    });

    it('funciona con payload mínimo (solo title y body)', async () => {
      mockSendNotification.mockResolvedValue({});

      const minPayload: PushPayload = { title: 'Hola', body: 'Mundo' };
      const result = await sendPushNotification(subscription, minPayload);

      expect(result).toBe(true);
    });
  });

  describe('suscripción expirada', () => {
    it('retorna false cuando statusCode es 410 (Gone)', async () => {
      mockSendNotification.mockRejectedValue(webPushError(410));

      const result = await sendPushNotification(subscription, payload);

      expect(result).toBe(false);
    });

    it('retorna false cuando statusCode es 404 (Not Found)', async () => {
      mockSendNotification.mockRejectedValue(webPushError(404));

      const result = await sendPushNotification(subscription, payload);

      expect(result).toBe(false);
    });
  });

  describe('errores no fatales', () => {
    it('retorna true (no fatal) en error 500', async () => {
      mockSendNotification.mockRejectedValue(webPushError(500));

      const result = await sendPushNotification(subscription, payload);

      expect(result).toBe(true);
    });

    it('retorna true (no fatal) en error 400', async () => {
      mockSendNotification.mockRejectedValue(webPushError(400));

      const result = await sendPushNotification(subscription, payload);

      expect(result).toBe(true);
    });

    it('retorna true (no fatal) en error de red sin statusCode', async () => {
      mockSendNotification.mockRejectedValue(new Error('Network error'));

      const result = await sendPushNotification(subscription, payload);

      expect(result).toBe(true);
    });
  });
});

describe('sendPushToMany()', () => {
  beforeEach(() => vi.clearAllMocks());

  const sub1: PushSubscriptionData = { endpoint: 'https://push.example.com/1', p256dh: 'k1', auth: 'a1' };
  const sub2: PushSubscriptionData = { endpoint: 'https://push.example.com/2', p256dh: 'k2', auth: 'a2' };
  const sub3: PushSubscriptionData = { endpoint: 'https://push.example.com/3', p256dh: 'k3', auth: 'a3' };

  it('devuelve array vacío cuando todas las suscripciones son válidas', async () => {
    mockSendNotification.mockResolvedValue({});

    const expired = await sendPushToMany([sub1, sub2], payload);

    expect(expired).toEqual([]);
  });

  it('devuelve array vacío cuando no hay suscripciones', async () => {
    const expired = await sendPushToMany([], payload);

    expect(expired).toEqual([]);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('devuelve los endpoints de suscripciones expiradas (410)', async () => {
    mockSendNotification
      .mockResolvedValueOnce({})                       // sub1: ok
      .mockRejectedValueOnce(webPushError(410))        // sub2: expirada
      .mockResolvedValueOnce({});                      // sub3: ok

    const expired = await sendPushToMany([sub1, sub2, sub3], payload);

    expect(expired).toContain(sub2.endpoint);
    expect(expired).toHaveLength(1);
  });

  it('devuelve múltiples endpoints expirados cuando varias fallan', async () => {
    mockSendNotification
      .mockRejectedValueOnce(webPushError(410))        // sub1: expirada
      .mockRejectedValueOnce(webPushError(404))        // sub2: expirada
      .mockResolvedValueOnce({});                      // sub3: ok

    const expired = await sendPushToMany([sub1, sub2, sub3], payload);

    expect(expired).toContain(sub1.endpoint);
    expect(expired).toContain(sub2.endpoint);
    expect(expired).toHaveLength(2);
  });

  it('no incluye subs con error no fatal en los expirados', async () => {
    mockSendNotification
      .mockRejectedValueOnce(webPushError(500))        // sub1: error no fatal
      .mockRejectedValueOnce(webPushError(410));       // sub2: expirada

    const expired = await sendPushToMany([sub1, sub2], payload);

    expect(expired).not.toContain(sub1.endpoint);
    expect(expired).toContain(sub2.endpoint);
  });

  it('llama a sendNotification una vez por suscripción', async () => {
    mockSendNotification.mockResolvedValue({});

    await sendPushToMany([sub1, sub2, sub3], payload);

    expect(mockSendNotification).toHaveBeenCalledTimes(3);
  });

  it('todas expiradas → devuelve todos los endpoints', async () => {
    mockSendNotification.mockRejectedValue(webPushError(410));

    const expired = await sendPushToMany([sub1, sub2], payload);

    expect(expired).toHaveLength(2);
    expect(expired).toContain(sub1.endpoint);
    expect(expired).toContain(sub2.endpoint);
  });
});
