// =============================================================================
// telegram-extractor.test.ts — Tests para telegram.extractor.ts
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { disconnectTelegram, extractTelegramChannel } from '../extractors/telegram.extractor';

// ── Mock de gramjs ────────────────────────────────────────────────────────────
const mockGetMessages = vi.fn();
const mockConnect     = vi.fn().mockResolvedValue(undefined);
const mockDisconnect  = vi.fn().mockResolvedValue(undefined);

vi.mock('telegram', () => ({
  TelegramClient: vi.fn().mockImplementation(function () {
    return {
      connected:   true,
      connect:     mockConnect,
      disconnect:  mockDisconnect,
      getMessages: mockGetMessages,
    };
  }),
}));

vi.mock('telegram/sessions/index.js', () => ({
  StringSession: vi.fn().mockImplementation(function () { return {}; }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMsg(id: number, message: string | null, date = 1700000000) {
  return { id, message, date, photo: null };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TELEGRAM_API_ID   = '12345678';
  process.env.TELEGRAM_API_HASH = 'abc123hash';
  process.env.TELEGRAM_SESSION  = 'fake_session_string';
});

afterEach(async () => {
  await disconnectTelegram();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('extractTelegramChannel', () => {
  it('extrae mensajes con contenido suficiente', async () => {
    const longText = 'A'.repeat(100);
    mockGetMessages.mockResolvedValue([
      makeMsg(1, longText),
      makeMsg(2, longText),
    ]);

    const result = await extractTelegramChannel('bogotaenplanes');

    expect(result.channel).toBe('bogotaenplanes');
    expect(result.messagesExtracted).toBe(2);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].url).toBe('https://t.me/bogotaenplanes/1');
    expect(result.messages[0].text).toBe(longText);
    expect(result.messages[0].date).toBeInstanceOf(Date);
  });

  it('filtra mensajes con texto muy corto (< minChars)', async () => {
    mockGetMessages.mockResolvedValue([
      makeMsg(1, 'Corto'),
      makeMsg(2, 'B'.repeat(100)),
    ]);

    const result = await extractTelegramChannel('testchannel');

    expect(result.messagesExtracted).toBe(1);
    expect(result.messages[0].id).toBe(2);
  });

  it('elimina @ del channelUsername', async () => {
    mockGetMessages.mockResolvedValue([makeMsg(1, 'C'.repeat(100))]);

    const result = await extractTelegramChannel('@bogotaenplanes');

    expect(result.channel).toBe('bogotaenplanes');
    expect(result.messages[0].url).toContain('https://t.me/bogotaenplanes/');
  });

  it('devuelve lista vacía si todos los mensajes son cortos', async () => {
    mockGetMessages.mockResolvedValue([
      makeMsg(1, 'Muy corto'),
      makeMsg(2, 'También corto'),
    ]);

    const result = await extractTelegramChannel('canal');

    expect(result.messagesExtracted).toBe(0);
    expect(result.messages).toHaveLength(0);
  });

  it('devuelve lista vacía si no hay mensajes', async () => {
    mockGetMessages.mockResolvedValue([]);

    const result = await extractTelegramChannel('canal_vacio');

    expect(result.messagesExtracted).toBe(0);
    expect(result.messages).toHaveLength(0);
  });

  it('respeta el parámetro minChars personalizado', async () => {
    mockGetMessages.mockResolvedValue([
      makeMsg(1, 'D'.repeat(30)),
      makeMsg(2, 'E'.repeat(60)),
    ]);

    const result = await extractTelegramChannel('canal', 50, 50);

    expect(result.messagesExtracted).toBe(1);
    expect(result.messages[0].id).toBe(2);
  });

  it('maneja mensajes sin texto (message = null)', async () => {
    mockGetMessages.mockResolvedValue([
      makeMsg(1, null),
      makeMsg(2, 'F'.repeat(100)),
    ]);

    const result = await extractTelegramChannel('canal');

    expect(result.messagesExtracted).toBe(1);
    expect(result.messages[0].id).toBe(2);
  });

  it('lanza error si faltan variables de entorno', async () => {
    delete process.env.TELEGRAM_SESSION;
    await disconnectTelegram();

    await expect(extractTelegramChannel('canal')).rejects.toThrow(
      'Faltan variables de entorno',
    );
  });
});

describe('disconnectTelegram', () => {
  it('no lanza error si no hay cliente activo', async () => {
    await disconnectTelegram();
    await expect(disconnectTelegram()).resolves.not.toThrow();
  });
});
