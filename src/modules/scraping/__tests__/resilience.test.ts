// =============================================================================
// Tests: modules/scraping/resilience.ts
// Mockea Prisma + logger — no toca la BD real
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks con vi.hoisted ──────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const mockSourceHealthFindUnique = vi.fn().mockResolvedValue(null);
  const mockSourceHealthUpsert     = vi.fn().mockResolvedValue({});

  return {
    mockSourceHealthFindUnique,
    mockSourceHealthUpsert,
  };
});

// Mockea el singleton de lib/db (el módulo usa `prisma` de ahí ahora)
vi.mock('../../../lib/db', () => ({
  prisma: {
    sourceHealth: {
      findUnique: mocks.mockSourceHealthFindUnique,
      upsert:     mocks.mockSourceHealthUpsert,
    },
  },
}));

vi.mock('dotenv/config', () => ({}));

import {
  classifyError,
  fetchWithRetry,
  fetchWithFallback,
  getSourceStrategies,
  updateSourceHealth,
  shouldSkipSource,
} from '../resilience';


// =============================================================================
// classifyError
// =============================================================================
describe('classifyError', () => {
  it('clasifica timeout por mensaje', () => {
    expect(classifyError(new Error('Request timeout'))).toBe('timeout');
    expect(classifyError(new Error('abort signal'))).toBe('timeout');
    expect(classifyError(new Error('ECONNRESET'))).toBe('timeout');
  });

  it('clasifica blocked por status 403', () => {
    const e = { message: 'forbidden', status: 403 };
    expect(classifyError(e)).toBe('blocked');
  });

  it('clasifica blocked por status 429', () => {
    const e = { message: 'rate limit exceeded', status: 429 };
    expect(classifyError(e)).toBe('blocked');
  });

  it('clasifica blocked por mensaje captcha', () => {
    expect(classifyError(new Error('captcha required'))).toBe('blocked');
  });

  it('clasifica parse_error por mensaje json', () => {
    expect(classifyError(new Error('invalid JSON syntax'))).toBe('parse_error');
    expect(classifyError(new Error('parse error in input'))).toBe('parse_error');
  });

  it('clasifica empty_response', () => {
    expect(classifyError(new Error('empty content'))).toBe('empty_response');
    expect(classifyError(new Error('no extractable text'))).toBe('empty_response');
  });

  it('clasifica unknown si no hay match', () => {
    expect(classifyError(new Error('some other error'))).toBe('unknown');
    expect(classifyError(null)).toBe('unknown');
    expect(classifyError({})).toBe('unknown');
  });
});

// =============================================================================
// fetchWithRetry
// =============================================================================
describe('fetchWithRetry', () => {
  it('retorna resultado en primer intento exitoso', async () => {
    const fetchFn = vi.fn().mockResolvedValue('contenido html');
    const result = await fetchWithRetry(fetchFn, 'test', 3);
    expect(result.data).toBe('contenido html');
    expect(result.methodUsed).toBe('test');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('lanza error si fetchFn devuelve string vacío', async () => {
    const fetchFn = vi.fn().mockResolvedValue('   ');
    await expect(fetchWithRetry(fetchFn, 'test', 1)).rejects.toThrow();
  });

  it('reintenta hasta maxRetries y luego lanza', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('unknown error'));
    await expect(fetchWithRetry(fetchFn, 'method', 2)).rejects.toThrow();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  }, 15000);

  it('no reintenta si el error es "blocked"', async () => {
    const blockedErr = { message: 'captcha required', status: 429 };
    const fetchFn = vi.fn().mockRejectedValue(blockedErr);
    await expect(fetchWithRetry(fetchFn, 'method', 3)).rejects.toEqual(blockedErr);
    // Sólo 1 intento — blocked detiene inmediatamente
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retorna resultado si primer intento falla pero el segundo tiene éxito', async () => {
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('ok data');
    const result = await fetchWithRetry(fetchFn, 'method', 2);
    expect(result.data).toBe('ok data');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  }, 10000);
});

// =============================================================================
// getSourceStrategies
// =============================================================================
describe('getSourceStrategies', () => {
  const url = 'https://example.com/page';
  const fakeExtractors = {
    cheerio: () => ({
      extract: vi.fn().mockResolvedValue({ status: 'OK', sourceText: 'contenido' }),
    }),
    playwright: () => ({
      extractWebText: vi.fn().mockResolvedValue({ status: 'OK', sourceText: 'contenido pw' }),
      extractProfile: vi.fn().mockResolvedValue({ posts: [] }),
    }),
  };

  it('retorna 2 estrategias para WEBSITE', () => {
    const strategies = getSourceStrategies('WEBSITE', fakeExtractors, url);
    expect(strategies).toHaveLength(2);
  });

  it('retorna 1 estrategia para INSTAGRAM', () => {
    const strategies = getSourceStrategies('INSTAGRAM', fakeExtractors, url);
    expect(strategies).toHaveLength(1);
  });

  it('retorna array vacío para tipo desconocido', () => {
    const strategies = getSourceStrategies('TELEGRAM', fakeExtractors, url);
    expect(strategies).toHaveLength(0);
  });

  it('estrategia WEBSITE cheerio invoca extract()', async () => {
    const mockExtract = vi.fn().mockResolvedValue({ status: 'OK', sourceText: 'texto largo suficiente para pasar el umbral de 50 chars' });
    const extractors = {
      cheerio: () => ({ extract: mockExtract }),
      playwright: () => ({ extractWebText: vi.fn(), extractProfile: vi.fn() }),
    };
    const strategies = getSourceStrategies('WEBSITE', extractors, url);
    const result = await strategies[0]();
    expect(mockExtract).toHaveBeenCalledWith(url);
    expect(result).toContain('texto largo');
  });

  it('estrategia WEBSITE cheerio lanza si status FAILED', async () => {
    const extractors = {
      cheerio: () => ({ extract: vi.fn().mockResolvedValue({ status: 'FAILED', sourceText: '' }) }),
      playwright: () => ({ extractWebText: vi.fn(), extractProfile: vi.fn() }),
    };
    const strategies = getSourceStrategies('WEBSITE', extractors, url);
    await expect(strategies[0]()).rejects.toThrow();
  });

  it('estrategia WEBSITE cheerio lanza si sourceText muy corto', async () => {
    const extractors = {
      cheerio: () => ({ extract: vi.fn().mockResolvedValue({ status: 'OK', sourceText: 'corto' }) }),
      playwright: () => ({ extractWebText: vi.fn(), extractProfile: vi.fn() }),
    };
    const strategies = getSourceStrategies('WEBSITE', extractors, url);
    await expect(strategies[0]()).rejects.toThrow();
  });

  it('estrategia WEBSITE playwright invoca extractWebText()', async () => {
    const mockExtractWebText = vi.fn().mockResolvedValue({ status: 'OK', sourceText: 'texto desde playwright' });
    const extractors = {
      cheerio: () => ({ extract: vi.fn() }),
      playwright: () => ({ extractWebText: mockExtractWebText, extractProfile: vi.fn() }),
    };
    const strategies = getSourceStrategies('WEBSITE', extractors, url);
    const result = await strategies[1]();
    expect(mockExtractWebText).toHaveBeenCalledWith(url);
    expect(result).toBe('texto desde playwright');
  });

  it('estrategia WEBSITE playwright lanza si status FAILED', async () => {
    const extractors = {
      cheerio: () => ({ extract: vi.fn() }),
      playwright: () => ({ extractWebText: vi.fn().mockResolvedValue({ status: 'FAILED', error: 'Navigation failed' }), extractProfile: vi.fn() }),
    };
    const strategies = getSourceStrategies('WEBSITE', extractors, url);
    await expect(strategies[1]()).rejects.toThrow('Navigation failed');
  });

  it('estrategia INSTAGRAM invoca extractProfile()', async () => {
    const mockExtractProfile = vi.fn().mockResolvedValue({ posts: [{ text: 'post 1' }] });
    const extractors = {
      cheerio: () => ({ extract: vi.fn() }),
      playwright: () => ({ extractWebText: vi.fn(), extractProfile: mockExtractProfile }),
    };
    const strategies = getSourceStrategies('INSTAGRAM', extractors, url);
    const result = await strategies[0]();
    expect(mockExtractProfile).toHaveBeenCalledWith(url, { maxPosts: 1 });
    expect(typeof result).toBe('string'); // JSON.stringify(res)
  });
});

// =============================================================================
// fetchWithFallback
// =============================================================================
describe('fetchWithFallback', () => {
  const url = 'https://example.com';

  it('retorna resultado de primera estrategia exitosa (WEBSITE)', async () => {
    const extractors = {
      cheerio: () => ({
        extract: vi.fn().mockResolvedValue({ status: 'OK', sourceText: 'A'.repeat(100) }),
      }),
      playwright: () => ({
        extractWebText: vi.fn(),
        extractProfile: vi.fn(),
      }),
    };
    const result = await fetchWithFallback(url, 'WEBSITE', extractors);
    expect(result.data).toContain('A');
    expect(result.methodUsed).toBe('Strategy_#1');
  });

  it('recurre a segunda estrategia si la primera falla (WEBSITE)', async () => {
    const extractors = {
      cheerio: () => ({
        extract: vi.fn().mockResolvedValue({ status: 'FAILED', sourceText: '' }),
      }),
      playwright: () => ({
        extractWebText: vi.fn().mockResolvedValue({ status: 'OK', sourceText: 'playwright ok' }),
        extractProfile: vi.fn(),
      }),
    };
    const result = await fetchWithFallback(url, 'WEBSITE', extractors);
    expect(result.methodUsed).toBe('Strategy_#2');
    expect(result.data).toBe('playwright ok');
  }, 10000);

  it('lanza si todas las estrategias fallan', async () => {
    const extractors = {
      cheerio: () => ({
        extract: vi.fn().mockResolvedValue({ status: 'FAILED', sourceText: '' }),
      }),
      playwright: () => ({
        extractWebText: vi.fn().mockResolvedValue({ status: 'FAILED', error: 'all failed' }),
        extractProfile: vi.fn(),
      }),
    };
    await expect(fetchWithFallback(url, 'WEBSITE', extractors)).rejects.toThrow();
  }, 15000);

  it('lanza inmediatamente si no hay estrategias (tipo desconocido)', async () => {
    const empty = { cheerio: () => ({ extract: vi.fn() }), playwright: () => ({ extractWebText: vi.fn(), extractProfile: vi.fn() }) };
    await expect(fetchWithFallback(url, 'TELEGRAM', empty)).rejects.toThrow('Sin estrategias validables');
  });
});

// =============================================================================
// updateSourceHealth
// =============================================================================
describe('updateSourceHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crea registro nuevo si no existe (success=true)', async () => {
    mocks.mockSourceHealthFindUnique.mockResolvedValue(null);
    await updateSourceHealth('ejemplo.com', { success: true, responseTimeMs: 500 });
    expect(mocks.mockSourceHealthUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = mocks.mockSourceHealthUpsert.mock.calls[0][0];
    expect(upsertArg.where.source).toBe('ejemplo.com');
    expect(upsertArg.create.successCount).toBe(1);
    expect(upsertArg.create.errorCount).toBe(0);
  });

  it('incrementa errorCount si success=false', async () => {
    mocks.mockSourceHealthFindUnique.mockResolvedValue(null);
    await updateSourceHealth('ejemplo.com', { success: false, responseTimeMs: 200 });
    const upsertArg = mocks.mockSourceHealthUpsert.mock.calls[0][0];
    expect(upsertArg.create.errorCount).toBe(1);
    expect(upsertArg.create.successCount).toBe(0);
  });

  it('aplica cold start neutral score (< 5 requests)', async () => {
    mocks.mockSourceHealthFindUnique.mockResolvedValue({
      successCount: 2, errorCount: 1, avgResponseMs: 300, status: 'healthy',
    });
    await updateSourceHealth('ejemplo.com', { success: true, responseTimeMs: 400 });
    const upsertArg = mocks.mockSourceHealthUpsert.mock.calls[0][0];
    // totalRequests = 4 → < 5 → newScore = 0.5
    expect(upsertArg.create.score).toBe(0.5);
  });

  it('actualiza registro existente acumulando conteos', async () => {
    mocks.mockSourceHealthFindUnique.mockResolvedValue({
      successCount: 10, errorCount: 2, avgResponseMs: 400, status: 'healthy',
    });
    await updateSourceHealth('ejemplo.com', { success: true, responseTimeMs: 600 });
    const upsertArg = mocks.mockSourceHealthUpsert.mock.calls[0][0];
    expect(upsertArg.create.successCount).toBe(11);
    expect(upsertArg.create.errorCount).toBe(2);
  });

  it('maneja error de Prisma sin propagar (catch interno)', async () => {
    mocks.mockSourceHealthFindUnique.mockRejectedValue(new Error('DB error'));
    await expect(updateSourceHealth('ejemplo.com', { success: true, responseTimeMs: 100 })).resolves.not.toThrow();
  });
});

// =============================================================================
// shouldSkipSource
// =============================================================================
describe('shouldSkipSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna { skip: false } si no hay registro de health', async () => {
    mocks.mockSourceHealthFindUnique.mockResolvedValue(null);
    const result = await shouldSkipSource('nuevo.com');
    expect(result).toEqual({ skip: false });
  });

  it('retorna { skip: false } si status no es critical', async () => {
    mocks.mockSourceHealthFindUnique.mockResolvedValue({ status: 'healthy', lastErrorAt: null });
    const result = await shouldSkipSource('normal.com');
    expect(result).toEqual({ skip: false });
  });

  it('retorna { skip: true } si status=critical y dentro del cooldown de 6h', async () => {
    const recentError = new Date(Date.now() - 60 * 60 * 1000); // 1h atrás (< 6h)
    mocks.mockSourceHealthFindUnique.mockResolvedValue({
      status: 'critical',
      lastErrorAt: recentError,
    });
    const result = await shouldSkipSource('critico.com');
    expect(result).toEqual({ skip: true, reason: 'CRITICAL_COOLDOWN' });
  });

  it('retorna { skip: false } si status=critical pero fuera del cooldown de 6h', async () => {
    const oldError = new Date(Date.now() - 8 * 60 * 60 * 1000); // 8h atrás (> 6h)
    mocks.mockSourceHealthFindUnique.mockResolvedValue({
      status: 'critical',
      lastErrorAt: oldError,
    });
    const result = await shouldSkipSource('recuperado.com');
    expect(result).toEqual({ skip: false });
  });
});
