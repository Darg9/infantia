// =============================================================================
// telegram.extractor.ts — Lector de canales públicos de Telegram vía MTProto
//
// Usa gramjs (TelegramClient) con una sesión autenticada para leer mensajes
// de canales públicos sin necesidad de ser miembro ni usar Bot API.
//
// Variables de entorno requeridas:
//   TELEGRAM_API_ID     — obtenido en my.telegram.org
//   TELEGRAM_API_HASH   — obtenido en my.telegram.org
//   TELEGRAM_SESSION    — generado con scripts/telegram-auth.ts
// =============================================================================

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { createLogger } from '@/lib/logger';

const log = createLogger('scraping:telegram');

export interface TelegramMessage {
  id:        number;
  text:      string;
  date:      Date;
  mediaUrl?: string;
  url:       string; // enlace al mensaje
}

export interface TelegramChannelData {
  channel:           string;
  messagesExtracted: number;
  messages:          TelegramMessage[];
}

// ── Singleton de cliente ─────────────────────────────────────────────────────
let _client: TelegramClient | null = null;

async function getClient(): Promise<TelegramClient> {
  if (_client?.connected) return _client;

  const apiId   = parseInt(process.env.TELEGRAM_API_ID   ?? '0', 10);
  const apiHash = process.env.TELEGRAM_API_HASH ?? '';
  const session = process.env.TELEGRAM_SESSION  ?? '';

  if (!apiId || !apiHash || !session) {
    throw new Error(
      'Faltan variables de entorno: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION. ' +
      'Ejecuta primero: npx tsx scripts/telegram-auth.ts'
    );
  }

  _client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 3,
    requestRetries:    3,
  });

  await _client.connect();
  log.info('Cliente Telegram conectado');
  return _client;
}

export async function disconnectTelegram(): Promise<void> {
  if (_client) {
    await _client.disconnect();
    _client = null;
    log.info('Cliente Telegram desconectado');
  }
}

// ── Extractor principal ──────────────────────────────────────────────────────

/**
 * Lee los últimos N mensajes de un canal público de Telegram.
 * @param channelUsername  Nombre del canal sin @ (ej: "bogotaenplanes")
 * @param limit            Máximo de mensajes a leer (default: 50)
 * @param minChars         Ignorar mensajes con menos de N caracteres (default: 80)
 */
export async function extractTelegramChannel(
  channelUsername: string,
  limit    = 50,
  minChars = 80,
): Promise<TelegramChannelData> {
  const client = await getClient();
  const clean  = channelUsername.replace(/^@/, '');

  log.info(`Leyendo canal @${clean} (últimos ${limit} mensajes)`);

  const messages = await client.getMessages(clean, { limit });

  const extracted: TelegramMessage[] = [];

  for (const msg of messages) {
    const text = (msg.message ?? '').trim();
    if (text.length < minChars) continue; // muy corto para ser una actividad

    // URL directa al mensaje en t.me
    const url = `https://t.me/${clean}/${msg.id}`;

    // Imagen: omitida por ahora (requiere subir a Supabase Storage)
    const mediaUrl: string | undefined = undefined;

    extracted.push({ id: msg.id, text, date: new Date(msg.date * 1000), mediaUrl, url });
  }

  log.info(`@${clean}: ${extracted.length} mensajes con contenido suficiente (de ${messages.length} totales)`);

  return { channel: clean, messagesExtracted: extracted.length, messages: extracted };
}
