import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() asegura que estas funciones mock estén disponibles cuando vi.mock() se ejecuta
const {
  mockExtract,
  mockExtractLinksAllPages,
  mockAnalyze,
  mockDiscoverActivityLinks,
  mockFilterNew,
  mockCacheAdd,
  mockCacheSave,
  mockSaveBatchResults,
  mockStorageDisconnect,
} = vi.hoisted(() => ({
  mockExtract: vi.fn(),
  mockExtractLinksAllPages: vi.fn(),
  mockAnalyze: vi.fn(),
  mockDiscoverActivityLinks: vi.fn(),
  mockFilterNew: vi.fn((urls: string[]) => urls),
  mockCacheAdd: vi.fn(),
  mockCacheSave: vi.fn(),
  mockSaveBatchResults: vi.fn(),
  mockStorageDisconnect: vi.fn(),
}));

vi.mock('../extractors/cheerio.extractor', () => ({
  CheerioExtractor: vi.fn(function(this: Record<string, unknown>) {
    this.extract = mockExtract;
    this.extractLinksAllPages = mockExtractLinksAllPages;
  }),
}));

vi.mock('../nlp/gemini.analyzer', () => ({
  GeminiAnalyzer: vi.fn(function(this: Record<string, unknown>) {
    this.analyze = mockAnalyze;
    this.discoverActivityLinks = mockDiscoverActivityLinks;
  }),
}));

vi.mock('../cache', () => ({
  ScrapingCache: vi.fn(function(this: Record<string, unknown>) {
    Object.defineProperty(this, 'size', { get: () => 0, configurable: true });
    this.filterNew = mockFilterNew;
    this.add = mockCacheAdd;
    this.save = mockCacheSave;
  }),
}));

vi.mock('../storage', () => ({
  ScrapingStorage: vi.fn(function(this: Record<string, unknown>) {
    this.saveBatchResults = mockSaveBatchResults;
    this.disconnect = mockStorageDisconnect;
  }),
}));

import { ScrapingPipeline } from '../pipeline';

const sampleNLPResult = {
  title: 'Taller de Robótica',
  description: 'Aprende robótica con Arduino',
  categories: ['Tecnología'],
  confidenceScore: 0.92,
  currency: 'COP',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFilterNew.mockImplementation((urls: string[]) => urls);
  mockSaveBatchResults.mockResolvedValue({ saved: 1, skipped: 0, errors: [] });
  mockStorageDisconnect.mockResolvedValue(undefined);
});

// ── runPipeline() ─────────────────────────────────────────────────────────────

describe('ScrapingPipeline.runPipeline()', () => {
  it('retorna resultado NLP cuando extracción y análisis son exitosos', async () => {
    mockExtract.mockResolvedValue({
      url: 'https://x.com/taller',
      sourceText: 'Texto largo con información del taller',
      status: 'SUCCESS',
    });
    mockAnalyze.mockResolvedValue(sampleNLPResult);

    const pipeline = new ScrapingPipeline();
    const result = await pipeline.runPipeline('https://x.com/taller');
    expect(result.title).toBe('Taller de Robótica');
    expect(mockExtract).toHaveBeenCalledWith('https://x.com/taller');
    expect(mockAnalyze).toHaveBeenCalled();
  });

  it('lanza error si la extracción falla (status FAILED)', async () => {
    mockExtract.mockResolvedValue({
      url: 'https://x.com/404',
      sourceText: '',
      status: 'FAILED',
      error: 'HTTP Error: 404',
    });
    const pipeline = new ScrapingPipeline();
    await expect(pipeline.runPipeline('https://x.com/404'))
      .rejects.toThrow('Falló la extracción inicial');
  });

  it('lanza error si sourceText está vacío (status SUCCESS pero sin texto)', async () => {
    mockExtract.mockResolvedValue({
      url: 'https://x.com/vacio',
      sourceText: '',
      status: 'SUCCESS',
    });
    const pipeline = new ScrapingPipeline();
    await expect(pipeline.runPipeline('https://x.com/vacio'))
      .rejects.toThrow('Falló la extracción inicial');
  });
});

// ── runBatchPipeline() ────────────────────────────────────────────────────────

describe('ScrapingPipeline.runBatchPipeline()', () => {
  const listingUrl = 'https://example.com/actividades';

  it('retorna discoveredLinks:0 si no se encuentran links', async () => {
    mockExtractLinksAllPages.mockResolvedValue([]);
    const pipeline = new ScrapingPipeline();
    const result = await pipeline.runBatchPipeline(listingUrl);
    expect(result.discoveredLinks).toBe(0);
    expect(result.filteredLinks).toBe(0);
    expect(result.results).toEqual([]);
  });

  it('retorna filteredLinks:0 si Gemini no identifica actividades', async () => {
    mockExtractLinksAllPages.mockResolvedValue([
      { url: 'https://example.com/nosotros', anchorText: 'Nosotros' },
    ]);
    mockDiscoverActivityLinks.mockResolvedValue([]);
    const pipeline = new ScrapingPipeline();
    const result = await pipeline.runBatchPipeline(listingUrl);
    expect(result.discoveredLinks).toBe(1);
    expect(result.filteredLinks).toBe(0);
  });

  it('retorna results vacío si todas las URLs ya están en cache', async () => {
    mockExtractLinksAllPages.mockResolvedValue([
      { url: 'https://example.com/taller', anchorText: 'Taller' },
    ]);
    mockDiscoverActivityLinks.mockResolvedValue(['https://example.com/taller']);
    mockFilterNew.mockReturnValue([]);
    const pipeline = new ScrapingPipeline();
    const result = await pipeline.runBatchPipeline(listingUrl);
    expect(result.results).toEqual([]);
    expect(result.filteredLinks).toBe(1);
  });

  it('procesa actividades nuevas y devuelve resultados exitosos', async () => {
    const urls = ['https://example.com/taller-1', 'https://example.com/taller-2'];
    mockExtractLinksAllPages.mockResolvedValue(
      urls.map(url => ({ url, anchorText: 'Taller' })),
    );
    mockDiscoverActivityLinks.mockResolvedValue(urls);
    mockExtract.mockResolvedValue({
      sourceText: 'Texto del taller muy largo para analizar',
      status: 'SUCCESS',
    });
    mockAnalyze.mockResolvedValue(sampleNLPResult);

    const pipeline = new ScrapingPipeline();
    const result = await pipeline.runBatchPipeline(listingUrl);
    expect(result.results).toHaveLength(2);
    expect(result.results.every(r => r.data !== null)).toBe(true);
    expect(mockCacheAdd).toHaveBeenCalledTimes(2);
    expect(mockCacheSave).toHaveBeenCalled();
  });

  it('registra error en resultado si runPipeline falla para una URL', async () => {
    mockExtractLinksAllPages.mockResolvedValue([
      { url: 'https://example.com/error-url', anchorText: 'Error' },
    ]);
    mockDiscoverActivityLinks.mockResolvedValue(['https://example.com/error-url']);
    mockExtract.mockResolvedValue({ sourceText: '', status: 'FAILED', error: 'timeout' });

    const pipeline = new ScrapingPipeline();
    const result = await pipeline.runBatchPipeline(listingUrl);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].data).toBeNull();
    expect(result.results[0].error).toBeTruthy();
  });

  it('guarda en BD si saveToDb está habilitado', async () => {
    mockExtractLinksAllPages.mockResolvedValue([
      { url: 'https://example.com/taller', anchorText: 'Taller' },
    ]);
    mockDiscoverActivityLinks.mockResolvedValue(['https://example.com/taller']);
    mockExtract.mockResolvedValue({
      sourceText: 'Texto del taller para analizar',
      status: 'SUCCESS',
    });
    mockAnalyze.mockResolvedValue(sampleNLPResult);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    await pipeline.runBatchPipeline(listingUrl);
    expect(mockSaveBatchResults).toHaveBeenCalled();
  });

  it('NO guarda en BD si saveToDb es false', async () => {
    mockExtractLinksAllPages.mockResolvedValue([
      { url: 'https://example.com/taller', anchorText: 'Taller' },
    ]);
    mockDiscoverActivityLinks.mockResolvedValue(['https://example.com/taller']);
    mockExtract.mockResolvedValue({ sourceText: 'Texto', status: 'SUCCESS' });
    mockAnalyze.mockResolvedValue(sampleNLPResult);

    const pipeline = new ScrapingPipeline({ saveToDb: false });
    await pipeline.runBatchPipeline(listingUrl);
    expect(mockSaveBatchResults).not.toHaveBeenCalled();
  });

  it('respeta parámetro concurrency procesando en lotes', async () => {
    const urls = Array.from({ length: 6 }, (_, i) => `https://example.com/taller-${i + 1}`);
    mockExtractLinksAllPages.mockResolvedValue(urls.map(url => ({ url, anchorText: 'T' })));
    mockDiscoverActivityLinks.mockResolvedValue(urls);
    mockExtract.mockResolvedValue({ sourceText: 'Texto', status: 'SUCCESS' });
    mockAnalyze.mockResolvedValue(sampleNLPResult);

    const pipeline = new ScrapingPipeline();
    const result = await pipeline.runBatchPipeline(listingUrl, 2);
    expect(result.results).toHaveLength(6);
  });
});

// ── disconnect() ──────────────────────────────────────────────────────────────

describe('ScrapingPipeline.disconnect()', () => {
  it('llama a storage.disconnect() si saveToDb está habilitado', async () => {
    const pipeline = new ScrapingPipeline({ saveToDb: true });
    await pipeline.disconnect();
    expect(mockStorageDisconnect).toHaveBeenCalled();
  });

  it('no hace nada si saveToDb no está habilitado', async () => {
    const pipeline = new ScrapingPipeline();
    await pipeline.disconnect();
    expect(mockStorageDisconnect).not.toHaveBeenCalled();
  });
});
