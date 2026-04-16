import { describe, it, expect, vi, beforeEach } from 'vitest';
import { savePreflightLog, _resetPrismaForTests } from '../utils/preflight-db';
import type { PreflightResult } from '../utils/date-preflight';

// ── Mocks ─────────────────────────────────────────────────────────────────────
// vi.hoisted() garantiza disponibilidad antes de que vi.mock() se ejecute.
// PrismaClient se mockea con `function` (no arrow) para ser usable como constructor.

const { mockExecuteRaw } = vi.hoisted(() => ({
  mockExecuteRaw: vi.fn().mockResolvedValue(1),
}));

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn(function(this: Record<string, unknown>) {}),
}));

vi.mock('../../../generated/prisma/client', () => ({
  PrismaClient: vi.fn(function(this: Record<string, unknown>) {
    this.$executeRawUnsafe = mockExecuteRaw;
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const okResult: PreflightResult = {
  skip: false, reason: 'process', datesFound: 1, matchedText: '2026-06-20',
};

const datetimePastResult: PreflightResult = {
  skip: true, reason: 'datetime_past', datesFound: 1, matchedText: '2025-01-10',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('savePreflightLog', () => {
  beforeEach(() => {
    mockExecuteRaw.mockClear();
    _resetPrismaForTests(); // nueva instancia de PrismaClient en cada test
  });

  it('llama a $executeRawUnsafe con los parámetros correctos para "ok"', async () => {
    await savePreflightLog({
      sourceId: 'biblored.gov.co',
      url: 'https://biblored.gov.co/event/1',
      result: okResult,
    });

    expect(mockExecuteRaw).toHaveBeenCalledOnce();
    expect(mockExecuteRaw).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO date_preflight_logs'),
      'biblored.gov.co',
      'https://biblored.gov.co/event/1',
      '2026-06-20',     // raw_date_text
      null,             // parsed_date
      'process',        // reason
      false,            // used_fallback (process → false)
      false,            // skip
    );
  });

  it('used_fallback=false para reason=datetime_past (capa 1 — más precisa)', async () => {
    await savePreflightLog({ url: 'https://example.com/1', result: datetimePastResult });

    expect(mockExecuteRaw).toHaveBeenCalledWith(
      expect.any(String),
      null,                // sourceId omitido → null
      'https://example.com/1',
      '2025-01-10',
      null,
      'datetime_past',
      false,               // datetime_past NO es fallback
      true,                // skip
    );
  });

  it('used_fallback=true para reason=text_date_past (capa 2)', async () => {
    const r: PreflightResult = {
      skip: true, reason: 'text_date_past', datesFound: 1, matchedText: '1 de marzo de 2026',
    };
    await savePreflightLog({ url: 'https://example.com/2', result: r });

    expect(mockExecuteRaw).toHaveBeenCalledWith(
      expect.any(String), null, 'https://example.com/2',
      '1 de marzo de 2026', null, 'text_date_past',
      true,   // fallback
      true,
    );
  });

  it('used_fallback=true para reason=past_year_only (capa 3a)', async () => {
    const r: PreflightResult = {
      skip: true, reason: 'past_year_only', datesFound: 0, matchedText: '2024',
    };
    await savePreflightLog({ url: 'https://example.com/3', result: r });

    expect(mockExecuteRaw).toHaveBeenCalledWith(
      expect.any(String), null, 'https://example.com/3',
      '2024', null, 'past_year_only',
      true,   // fallback
      true,
    );
  });

  it('used_fallback=true para reason=keyword_past (capa 3b)', async () => {
    const r: PreflightResult = {
      skip: true, reason: 'keyword_past', datesFound: 0, matchedText: 'finalizado',
    };
    await savePreflightLog({ url: 'https://example.com/4', result: r });

    expect(mockExecuteRaw).toHaveBeenCalledWith(
      expect.any(String), null, 'https://example.com/4',
      'finalizado', null, 'keyword_past',
      true,   // fallback
      true,
    );
  });

  it('no lanza excepción si la BD falla (fire-and-forget)', async () => {
    mockExecuteRaw.mockRejectedValueOnce(new Error('Connection refused'));

    await expect(
      savePreflightLog({ url: 'https://example.com/5', result: okResult })
    ).resolves.toBeUndefined();
  });

  it('acepta sourceId=null (URL sin fuente identificada)', async () => {
    await savePreflightLog({ sourceId: null, url: 'https://example.com/6', result: okResult });

    expect(mockExecuteRaw).toHaveBeenCalledWith(
      expect.any(String),
      null,    // sourceId
      'https://example.com/6',
      expect.anything(), null, expect.any(String), expect.any(Boolean), expect.any(Boolean),
    );
  });

  it('raw_date_text es null cuando matchedText es null', async () => {
    const noSignal: PreflightResult = {
      skip: false, reason: 'process', datesFound: 0, matchedText: null,
    };
    await savePreflightLog({ url: 'https://example.com/7', result: noSignal });

    expect(mockExecuteRaw).toHaveBeenCalledWith(
      expect.any(String), null, 'https://example.com/7',
      null,      // raw_date_text null
      null, 'process', false, false,
    );
  });
});
