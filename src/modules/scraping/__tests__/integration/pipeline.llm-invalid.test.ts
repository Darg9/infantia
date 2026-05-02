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

    // La URL tiene data con isActivity=false (rechazada por LLM fail-safe).
    // El pipeline empuja { url, data } incluso para rechazos — data: null solo ocurre en errores de red.
    const r = result.results[0];
    expect(r.data).not.toBeNull();
    expect(r.data?.isActivity).toBe(false);

    // saveBatchResults recibe el BatchPipelineResult completo (objeto, no array).
    // Se llama siempre que hay storage y URLs procesadas — la storage decide qué guardar.
    expect(mockSaveBatchResults).toHaveBeenCalledTimes(1);
    const batchArg = mockSaveBatchResults.mock.calls[0][0];
    expect(batchArg).toHaveProperty('results');
    // El resultado tiene isActivity=false → storage no lo guardará
    const savedResults = batchArg.results as Array<{ data: { isActivity?: boolean } | null }>;
    const activeItems = savedResults.filter((r) => r.data?.isActivity === true);
    expect(activeItems).toHaveLength(0);
  });

  it('runBatchPipeline: NO guarda individualmente cuando confidenceScore < threshold', async () => {
    mockExtractLinksAllPages.mockResolvedValue([{ url: URL_LOW_CONF, anchorText: 'Ambiguo' }]);
    mockDiscoverActivityLinks.mockResolvedValue([URL_LOW_CONF]);
    mockAnalyze.mockResolvedValue(NLP_LOW_CONFIDENCE);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    const result = await pipeline.runBatchPipeline(LISTING_URL);

    // El batch procesó la URL
    expect(result.results).toHaveLength(1);

    // El streaming save (inline en Fase 3) no llamó a saveActivity porque confidenceScore=0.08 < 0.3
    expect(mockSaveActivity).not.toHaveBeenCalled();

    // saveBatchResults SÍ se llama con el batchResult completo — es la fase de contabilidad final
    expect(mockSaveBatchResults).toHaveBeenCalledTimes(1);
    const batchArg = mockSaveBatchResults.mock.calls[0][0];
    // El resultado tiene confidenceScore bajo — el storage lo contabilizará como skipped
    expect(batchArg.results[0].data?.confidenceScore).toBe(0.08);
  });

  it('runBatchPipeline mixto: válidas se guardan individualmente, inválidas no llaman saveActivity', async () => {
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
    expect(okResult?.data?.isActivity).toBe(true);

    // La URL inválida tiene data con isActivity=false (no es null — fue parseada, pero rechazada)
    const badResult = result.results.find((r) => r.url === URL_NOT_ACT);
    expect(badResult?.data).not.toBeNull();
    expect(badResult?.data?.isActivity).toBe(false);

    // saveActivity solo fue llamado para la URL válida (streaming save inline en Fase 3)
    expect(mockSaveActivity).toHaveBeenCalledTimes(1);

    // saveBatchResults recibe el BatchPipelineResult completo (objeto con propiedad results[])
    expect(mockSaveBatchResults).toHaveBeenCalledTimes(1);
    const batchArg = mockSaveBatchResults.mock.calls[0][0];
    expect(batchArg).toHaveProperty('results');
    const batchResults = batchArg.results as Array<{ url: string; data: { isActivity?: boolean } | null }>;
    // El batch contiene ambas URLs pero storage discrimina por isActivity
    expect(batchResults.some((r) => r.url === URL_OK)).toBe(true);
    expect(batchResults.some((r) => r.url === URL_NOT_ACT)).toBe(true);
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

    // Primera URL → LLM lanza error (quota); Segunda → respuesta válida
    // Con PARSER_FALLBACK_ENABLED=true (default), el error de Gemini activa el Cheerio fallback.
    // El fallback produce un resultado con parserSource='fallback' y confidenceScore=0.5.
    // Por lo tanto, failResult?.data NO es null — es un objeto con parserSource='fallback'.
    mockAnalyze
      .mockRejectedValueOnce(new Error('Gemini API quota exceeded'))
      .mockResolvedValueOnce(NLP_VALID);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    const result = await pipeline.runBatchPipeline(LISTING_URL);

    // Las 2 URLs fueron intentadas
    expect(result.results).toHaveLength(2);

    // La URL con error de LLM: el fallback Cheerio produjo un resultado parcial
    // (no null — el pipeline es resiliente y no propaga el error al nivel de resultado)
    const failResult = result.results.find((r) => r.url === URL_LLM_FAIL);
    expect(failResult).toBeDefined();
    // El fallback tiene parserSource='fallback' con confidenceScore=0.5
    if (failResult?.data !== null) {
      // Comportamiento con PARSER_FALLBACK_ENABLED=true: data tiene parserSource fallback
      expect(failResult?.data?.parserSource).toBe('fallback');
    } else {
      // Comportamiento legacy (PARSER_FALLBACK_ENABLED=false): data=null con error
      expect(failResult?.error).toContain('quota');
    }

    // La URL con LLM exitoso tiene datos válidos
    const okResult = result.results.find((r) => r.url === URL_LLM_OK);
    expect(okResult?.data?.confidenceScore).toBeGreaterThanOrEqual(0.3);
    expect(okResult?.data?.isActivity).toBe(true);
  });
});
