/**
 * Integration Test — Escenario 2: Error de red
 *
 * Valida que el pipeline:
 *   1. Clasifica correctamente el error (timeout, blocked, etc.)
 *   2. No lanza excepción no capturada (no crash del worker)
 *   3. El resultado reporta el error correctamente
 *   4. El logger registra FAILED cuando corresponde
 *
 * Mocks en los BORDES únicamente: extractores (red HTTP), prisma (DB)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks hoisted ─────────────────────────────────────────────────────────────

const {
  mockExtract,
  mockExtractLinksAllPages,
  mockDiscoverActivityLinks,
  mockSaveBatchResults,
  mockSaveActivity,
  mockStorageDisconnect,
  mockGetOrCreateSource,
  mockStartRun,
  mockCompleteRun,
  mockUpdateSourceStatus,
} = vi.hoisted(() => ({
  mockExtract:               vi.fn(),
  mockExtractLinksAllPages:  vi.fn(),
  mockDiscoverActivityLinks: vi.fn(),
  mockSaveBatchResults:      vi.fn(),
  mockSaveActivity:          vi.fn(),
  mockStorageDisconnect:     vi.fn(),
  mockGetOrCreateSource:     vi.fn(),
  mockStartRun:              vi.fn(),
  mockCompleteRun:           vi.fn(),
  mockUpdateSourceStatus:    vi.fn(),
}));

// ── Mocks de módulos ──────────────────────────────────────────────────────────

vi.mock('../../extractors/cheerio.extractor', () => {
  const Ctor = vi.fn(function (this: Record<string, unknown>) {
    this.extract              = mockExtract;
    this.extractLinksAllPages = mockExtractLinksAllPages;
    this.extractSitemapLinks  = vi.fn().mockResolvedValue([]);
  }) as unknown as new () => unknown;
  (Ctor as unknown as { textFromHtml: (h: string) => string }).textFromHtml =
    (h: string) => h.replace(/<[^>]*>/g, ' ').trim();
  return { CheerioExtractor: Ctor };
});

vi.mock('../../extractors/playwright.extractor', () => ({
  PlaywrightExtractor: vi.fn(function (this: Record<string, unknown>) {
    this.extractProfile  = vi.fn();
    this.close           = vi.fn();
    this.extractWebLinks = vi.fn().mockResolvedValue([]);
    this.extractWebText  = vi.fn().mockResolvedValue({
      url: '', sourceText: '', html: '', extractedAt: new Date(), status: 'FAILED' as const,
    });
  }),
}));

vi.mock('../../nlp/gemini.analyzer', () => ({
  GeminiAnalyzer: vi.fn(function (this: Record<string, unknown>) {
    this.analyze               = vi.fn();
    this.analyzeInstagramPost  = vi.fn();
    this.discoverActivityLinks = mockDiscoverActivityLinks;
  }),
}));

vi.mock('../../storage', () => ({
  ScrapingStorage: vi.fn(function (this: Record<string, unknown>) {
    this.saveBatchResults = mockSaveBatchResults;
    this.saveActivity     = mockSaveActivity;
    this.disconnect       = mockStorageDisconnect;
  }),
}));

vi.mock('../../logger', () => ({
  ScrapingLogger: vi.fn(function (this: Record<string, unknown>) {
    this.getOrCreateSource  = mockGetOrCreateSource;
    this.startRun           = mockStartRun;
    this.completeRun        = mockCompleteRun;
    this.updateSourceStatus = mockUpdateSourceStatus;
  }),
}));

vi.mock('../../cache', () => ({
  ScrapingCache: vi.fn(function (this: Record<string, unknown>) {
    Object.defineProperty(this, 'size', { get: () => 0, configurable: true });
    this.has            = vi.fn().mockReturnValue(false);
    this.filterNew      = vi.fn((urls: string[]) => urls);
    this.add            = vi.fn();
    this.save           = vi.fn();
    this.setSource      = vi.fn();
    this.syncFromDb     = vi.fn().mockResolvedValue(undefined);
    this.saveToDb       = vi.fn().mockResolvedValue(undefined);
    this.getReparseUrls = vi.fn().mockReturnValue([]);
    this.filterSPI      = vi.fn((entries: Array<{ url: string }>) => ({
      urls: entries.map((e) => e.url),
      spiSkipped: 0,
    }));
  }),
}));

vi.mock('../../resilience', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../resilience')>();
  return {
    ...actual,
    fetchWithFallback: vi.fn().mockImplementation(async (url: string, _platform: string, strategies: Record<string, () => unknown>) => {
      const cheerioFn = strategies['cheerio'] as (() => {
        extract: (url: string) => Promise<{ sourceText: string; status: string; error?: string }>;
      });
      if (cheerioFn) {
        const extractor = cheerioFn();
        const result = await extractor.extract(url);
        if (!result || result.status === 'FAILED' || !result.sourceText) {
          throw new Error(result?.error ?? 'Extraction failed');
        }
        return { data: result.sourceText, responseTime: 0 };
      }
      throw new Error('No cheerio strategy provided');
    }),
    updateSourceHealth: vi.fn().mockResolvedValue(undefined),
    shouldSkipSource:   vi.fn().mockResolvedValue({ skip: false, reason: null }),
  };
});

vi.mock('../../../lib/db', () => ({
  prisma: {
    activity: { findMany: vi.fn().mockResolvedValue([]) },
    city:     { findFirst:  vi.fn().mockResolvedValue({ id: 'city-bog' }) },
    vertical: { findUnique: vi.fn().mockResolvedValue({ id: 'vert-kids' }) },
    sourceHealth: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert:     vi.fn().mockResolvedValue({}),
      update:     vi.fn().mockResolvedValue({}),
    },
    $disconnect: vi.fn(),
  },
}));

// (Removido mock de generated/prisma/client para usar el mock unificado en lib/db)


// ── Tests ─────────────────────────────────────────────────────────────────────

import { ScrapingPipeline } from '../../pipeline';
import { classifyError } from '../../resilience';

describe('Integration: pipeline — error de red', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockStorageDisconnect.mockResolvedValue(undefined);
    mockGetOrCreateSource.mockResolvedValue('source-1');
    mockStartRun.mockResolvedValue('log-run-net');
    mockCompleteRun.mockResolvedValue(undefined);
    mockUpdateSourceStatus.mockResolvedValue(undefined);
  });

  // ── Clasificación de errores ────────────────────────────────────────────────

  it('classifyError: clasifica timeout correctamente', () => {
    expect(classifyError(new Error('connect ETIMEDOUT'))).toBe('timeout');
    expect(classifyError(new Error('Request timeout after 30000ms'))).toBe('timeout');
    expect(classifyError(new Error('The operation was aborted'))).toBe('timeout');
    expect(classifyError(new Error('ECONNRESET'))).toBe('timeout');
  });

  it('classifyError: clasifica blocked / rate-limit correctamente', () => {
    expect(classifyError({ status: 429, message: 'Too Many Requests' })).toBe('blocked');
    expect(classifyError({ status: 403, message: 'Forbidden' })).toBe('blocked');
    expect(classifyError(new Error('CAPTCHA detected on page'))).toBe('blocked');
    expect(classifyError(new Error('rate limit exceeded'))).toBe('blocked');
  });

  it('classifyError: clasifica parse error correctamente', () => {
    expect(classifyError(new Error('Failed to parse HTML'))).toBe('parse_error');
  });

  it('classifyError: clasifica empty response correctamente', () => {
    expect(classifyError(new Error('Empty response received'))).toBe('empty_response');
  });

  it('classifyError: devuelve unknown para errores no clasificables', () => {
    expect(classifyError(new Error('Something completely unexpected'))).toBe('unknown');
    expect(classifyError('string error')).toBe('unknown');
    expect(classifyError(null)).toBe('unknown');
  });

  // ── Resiliencia del pipeline ────────────────────────────────────────────────

  it('runPipeline: lanza error controlado cuando extracción falla por timeout', async () => {
    mockExtract.mockResolvedValue({
      url:        'https://bloqueado.com/evento',
      sourceText: '',
      status:     'FAILED',
      error:      'connect ETIMEDOUT 192.168.1.1:443',
    });

    const pipeline = new ScrapingPipeline();

    // El pipeline DEBE rechazar — no retorna null silenciosamente
    await expect(
      pipeline.runPipeline('https://bloqueado.com/evento'),
    ).rejects.toThrow(/Extracción abortada|Falló la extracción/);

    // No se guardó nada
    expect(mockSaveActivity).not.toHaveBeenCalled();
  });

  it('runPipeline: lanza error controlado cuando extracción devuelve texto vacío', async () => {
    mockExtract.mockResolvedValue({
      url:        'https://example.com/evento',
      sourceText: '',
      status:     'SUCCESS', // SUCCESS pero sin texto
    });

    const pipeline = new ScrapingPipeline();
    await expect(
      pipeline.runPipeline('https://example.com/evento'),
    ).rejects.toThrow(/Extracción abortada|Falló la extracción/);
  });

  it('runBatchPipeline: registra error por URL pero NO crashea el batch completo', async () => {
    // Listado devuelve 2 links
    mockExtractLinksAllPages.mockResolvedValue([
      { url: 'https://x.com/error-event', anchorText: 'Evento 1' },
      { url: 'https://x.com/ok-event',    anchorText: 'Evento 2' },
    ]);

    // Gemini identifica ambas como actividades
    mockDiscoverActivityLinks.mockResolvedValue([
      'https://x.com/error-event',
      'https://x.com/ok-event',
    ]);

    // Ambas URLs fallan al extraer (timeout)
    mockExtract.mockResolvedValue({
      url:        '',
      sourceText: '',
      status:     'FAILED',
      error:      'Request timeout after 30000ms',
    });

    const pipeline = new ScrapingPipeline();
    const result = await pipeline.runBatchPipeline('https://x.com/listado');

    // El batch NO lanzó excepción
    expect(result).toBeDefined();

    // Tiene exactamente 2 resultados (uno por URL)
    expect(result.results).toHaveLength(2);

    // Todas con error reportado
    const failedResults = result.results.filter((r) => r.data === null && r.error);
    expect(failedResults.length).toBe(2);
    expect(failedResults[0].error).toBeTruthy();

    // No se guardó nada en BD
    expect(mockSaveBatchResults).not.toHaveBeenCalled();
  });

  it('runBatchPipeline con saveToDb=true: logger registra FAILED cuando 0 links encontrados', async () => {
    // Sitio completamente vacío o bloqueado
    mockExtractLinksAllPages.mockResolvedValue([]);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    await pipeline.runBatchPipeline('https://bloqueado.com/agenda');

    // Logger registró el fallo
    expect(mockCompleteRun).toHaveBeenCalledWith(
      'log-run-net',
      expect.objectContaining({
        itemsFound: 0,
        errorMessage: 'No links found',
      }),
    );
    expect(mockUpdateSourceStatus).toHaveBeenCalledWith('source-1', 'FAILED', 0);
  });

  it('runBatchPipeline: un error parcial no detiene el procesamiento de URLs restantes', async () => {
    const URL_FAIL = 'https://x.com/error';
    const URL_OK   = 'https://x.com/ok';

    mockExtractLinksAllPages.mockResolvedValue([
      { url: URL_FAIL, anchorText: 'Evento con error' },
      { url: URL_OK,   anchorText: 'Evento OK' },
    ]);
    mockDiscoverActivityLinks.mockResolvedValue([URL_FAIL, URL_OK]);

    // Primera falla, segunda exitosa
    mockExtract
      .mockResolvedValueOnce({ url: URL_FAIL, sourceText: '', status: 'FAILED', error: 'timeout' })
      .mockResolvedValueOnce({ url: URL_OK, sourceText: 'Taller de arte para niños.', status: 'SUCCESS' });

    // El analyzer solo se llama para la URL OK
    const { GeminiAnalyzer } = await import('../../nlp/gemini.analyzer');
    vi.mocked(GeminiAnalyzer).mock.instances[0];

    const pipeline = new ScrapingPipeline();
    const result = await pipeline.runBatchPipeline('https://x.com/listado');

    // Ambas URLs presentes en results
    expect(result.results).toHaveLength(2);

    // La URL que falló tiene error
    const failResult = result.results.find((r) => r.url === URL_FAIL);
    expect(failResult?.data).toBeNull();
    expect(failResult?.error).toBeTruthy();

    // El batch no terminó antes de tiempo
    expect(result.discoveredLinks).toBe(2);
  });
});
