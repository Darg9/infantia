/**
 * Integration Test — Escenario 3: Output inválido del LLM
 *
 * Valida que el pipeline rechaza correctamente respuestas inválidas del LLM:
 *   1. isActivity: false → rechazado antes de guardar
 *   2. confidenceScore bajo → no guardado en BD
 *   3. Batch mixto: URLs válidas se guardan, inválidas reportan error sin contaminar DB
 *
 * Garantías:
 *   - No se insertan datos corruptos en DB
 *   - El error es reportado claramente en el resultado
 *   - El batch continúa procesando otras URLs
 *
 * Mocks en los BORDES: analizador LLM (result), prisma (DB)
 * El analizador se mockea a nivel de resultado (no de fetch) porque GeminiAnalyzer
 * ya tiene sus propios tests unitarios para el parsing de JSON.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Fixtures LLM ─────────────────────────────────────────────────────────────

const NLP_NOT_ACTIVITY = {
  title:           'Post promocional',
  description:     'Compra nuestros productos con 20% de descuento.',
  isActivity:      false,
  categories:      ['General'],
  confidenceScore: 0.05,
  currency:        'COP',
};

const NLP_LOW_CONFIDENCE = {
  title:           'Contenido ambiguo',
  description:     'No está claro si es actividad infantil.',
  isActivity:      true,
  categories:      ['General'],
  confidenceScore: 0.08, // por debajo del threshold de guardado (0.3)
  currency:        'COP',
};

const NLP_VALID = {
  title:           'Taller de Arte Infantil',
  description:     'Taller de pintura para niños de 4 a 10 años.',
  isActivity:      true,
  categories:      ['Arte'],
  minAge:          4,
  maxAge:          10,
  price:           50000,
  pricePeriod:     'PER_SESSION' as const,
  currency:        'COP',
  audience:        'KIDS' as const,
  confidenceScore: 0.88,
};

// ── Mocks hoisted ─────────────────────────────────────────────────────────────

const {
  mockExtract,
  mockExtractLinksAllPages,
  mockAnalyze,
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
  mockAnalyze:               vi.fn(),
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
    this.analyze               = mockAnalyze;
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


// ── Tests ─────────────────────────────────────────────────────────────────────

import { ScrapingPipeline } from '../../pipeline';

describe('Integration: pipeline — output inválido del LLM', () => {
  const LISTING_URL  = 'https://example.com/listado';
  const URL_NOT_ACT  = 'https://example.com/promo';
  const URL_LOW_CONF = 'https://example.com/ambiguo';
  const URL_OK       = 'https://example.com/taller-arte';

  beforeEach(() => {
    vi.clearAllMocks();

    mockStorageDisconnect.mockResolvedValue(undefined);
    mockGetOrCreateSource.mockResolvedValue('source-1');
    mockStartRun.mockResolvedValue('log-llm');
    mockCompleteRun.mockResolvedValue(undefined);
    mockUpdateSourceStatus.mockResolvedValue(undefined);
    mockSaveBatchResults.mockResolvedValue({ saved: 0, skipped: 0, errors: [] });
    mockSaveActivity.mockResolvedValue('activity-xyz');

    // Extractor siempre devuelve texto (el error viene del LLM, no del scraping)
    mockExtract.mockResolvedValue({
      url:        '',
      sourceText: 'Contenido extraído de la página.',
      status:     'SUCCESS',
    });
  });

  it('runBatchPipeline: NO guarda cuando LLM responde isActivity=false', async () => {
    mockExtractLinksAllPages.mockResolvedValue([{ url: URL_NOT_ACT, anchorText: 'Promo' }]);
    mockDiscoverActivityLinks.mockResolvedValue([URL_NOT_ACT]);
    mockAnalyze.mockResolvedValue(NLP_NOT_ACTIVITY);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    const result = await pipeline.runBatchPipeline(LISTING_URL);

    // El batch no crasheó
    expect(result).toBeDefined();
    expect(result.results).toHaveLength(1);

    // La URL tiene data=null (isActivity=false → rechazado) o confidenceScore muy bajo
    const r = result.results[0];
    const isRejected = r.data === null || (r.data !== null && r.data.isActivity === false);
    expect(isRejected).toBe(true);

    // NO se guardó nada en BD
    expect(mockSaveBatchResults).not.toHaveBeenCalled();
  });

  it('runBatchPipeline: NO guarda cuando confidenceScore < 0.3', async () => {
    mockExtractLinksAllPages.mockResolvedValue([{ url: URL_LOW_CONF, anchorText: 'Ambiguo' }]);
    mockDiscoverActivityLinks.mockResolvedValue([URL_LOW_CONF]);
    mockAnalyze.mockResolvedValue(NLP_LOW_CONFIDENCE);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    const result = await pipeline.runBatchPipeline(LISTING_URL);

    // El batch procesó la URL
    expect(result.results).toHaveLength(1);

    // No se guardó (threshold 0.3 no alcanzado)
    expect(mockSaveBatchResults).not.toHaveBeenCalled();
  });

  it('runBatchPipeline mixto: válidas se guardan, inválidas reportan error sin contaminar DB', async () => {
    mockExtractLinksAllPages.mockResolvedValue([
      { url: URL_OK,      anchorText: 'Taller Arte' },
      { url: URL_NOT_ACT, anchorText: 'Promo' },
    ]);
    mockDiscoverActivityLinks.mockResolvedValue([URL_OK, URL_NOT_ACT]);

    // Primera URL → válida; Segunda → no es actividad
    mockExtract
      .mockResolvedValueOnce({ url: URL_OK,      sourceText: 'Taller de arte para niños.',   status: 'SUCCESS' })
      .mockResolvedValueOnce({ url: URL_NOT_ACT, sourceText: 'Descuento 30% este fin de semana.', status: 'SUCCESS' });

    mockAnalyze
      .mockResolvedValueOnce(NLP_VALID)
      .mockResolvedValueOnce(NLP_NOT_ACTIVITY);

    mockSaveBatchResults.mockResolvedValue({ saved: 1, skipped: 0, errors: [] });

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    const result = await pipeline.runBatchPipeline(LISTING_URL);

    // Ambas URLs procesadas
    expect(result.results).toHaveLength(2);

    // La URL válida tiene data con confidenceScore alto
    const okResult = result.results.find((r) => r.url === URL_OK);
    expect(okResult?.data).not.toBeNull();
    expect(okResult?.data?.confidenceScore).toBeGreaterThanOrEqual(0.3);

    // La URL inválida: data=null o isActivity=false
    const badResult = result.results.find((r) => r.url === URL_NOT_ACT);
    const badRejected = badResult?.data === null ||
      (badResult?.data !== null && badResult?.data?.isActivity === false);
    expect(badRejected).toBe(true);

    // Solo las actividades válidas llegaron a saveBatchResults
    expect(mockSaveBatchResults).toHaveBeenCalledTimes(1);
    const savedPayload = mockSaveBatchResults.mock.calls[0][0] as Array<{ url: string }>;
    expect(savedPayload.some((a) => a.url === URL_OK)).toBe(true);
    expect(savedPayload.some((a) => a.url === URL_NOT_ACT)).toBe(false);
  });

  it('runPipeline: lanza error cuando GeminiAnalyzer rechaza schema inválido', async () => {
    // GeminiAnalyzer lanza si el schema Zod falla — simulamos el error que propagaría
    mockAnalyze.mockRejectedValue(
      new Error('Respuesta de Claude no cumple el schema: confidenceScore: Required'),
    );
    mockExtract.mockResolvedValue({
      url:        'https://example.com/actividad',
      sourceText: 'Texto extraído de la página del evento.',
      status:     'SUCCESS',
    });

    const pipeline = new ScrapingPipeline();
    await expect(
      pipeline.runPipeline('https://example.com/actividad'),
    ).rejects.toThrow(/schema|Schema/i);

    // No se guardó nada
    expect(mockSaveActivity).not.toHaveBeenCalled();
  });

  it('runBatchPipeline: el LLM que falla en una URL no impide procesar las demás', async () => {
    const URL_LLM_FAIL = 'https://x.com/llm-crash';
    const URL_LLM_OK   = 'https://x.com/llm-ok';

    mockExtractLinksAllPages.mockResolvedValue([
      { url: URL_LLM_FAIL, anchorText: 'Crash' },
      { url: URL_LLM_OK,   anchorText: 'OK' },
    ]);
    mockDiscoverActivityLinks.mockResolvedValue([URL_LLM_FAIL, URL_LLM_OK]);

    mockExtract.mockResolvedValue({ url: '', sourceText: 'Texto.', status: 'SUCCESS' });

    // Primera URL → LLM lanza error; Segunda → respuesta válida
    mockAnalyze
      .mockRejectedValueOnce(new Error('Gemini API quota exceeded'))
      .mockResolvedValueOnce(NLP_VALID);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    const result = await pipeline.runBatchPipeline(LISTING_URL);

    // Las 2 URLs fueron intentadas
    expect(result.results).toHaveLength(2);

    // La URL con LLM fallido reporta error
    const failResult = result.results.find((r) => r.url === URL_LLM_FAIL);
    expect(failResult?.data).toBeNull();
    expect(failResult?.error).toContain('quota');

    // La URL con LLM exitoso tiene datos
    const okResult = result.results.find((r) => r.url === URL_LLM_OK);
    expect(okResult?.data?.confidenceScore).toBeGreaterThanOrEqual(0.3);
  });
});
