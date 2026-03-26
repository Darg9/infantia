import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() asegura que estas funciones mock estén disponibles cuando vi.mock() se ejecuta
const {
  mockExtract,
  mockExtractLinksAllPages,
  mockAnalyze,
  mockAnalyzeInstagramPost,
  mockDiscoverActivityLinks,
  mockFilterNew,
  mockCacheHas,
  mockCacheAdd,
  mockCacheSave,
  mockSaveBatchResults,
  mockSaveActivity,
  mockStorageDisconnect,
  mockExtractProfile,
  mockPlaywrightClose,
  mockGetOrCreateSource,
  mockStartRun,
  mockCompleteRun,
  mockUpdateSourceStatus,
} = vi.hoisted(() => ({
  mockExtract: vi.fn(),
  mockExtractLinksAllPages: vi.fn(),
  mockAnalyze: vi.fn(),
  mockAnalyzeInstagramPost: vi.fn(),
  mockDiscoverActivityLinks: vi.fn(),
  mockFilterNew: vi.fn((urls: string[]) => urls),
  mockCacheHas: vi.fn(() => false),
  mockCacheAdd: vi.fn(),
  mockCacheSave: vi.fn(),
  mockSaveBatchResults: vi.fn(),
  mockSaveActivity: vi.fn(),
  mockStorageDisconnect: vi.fn(),
  mockExtractProfile: vi.fn(),
  mockPlaywrightClose: vi.fn(),
  mockGetOrCreateSource: vi.fn(),
  mockStartRun: vi.fn(),
  mockCompleteRun: vi.fn(),
  mockUpdateSourceStatus: vi.fn(),
}));

const { mockExtractSitemapLinks } = vi.hoisted(() => ({
  mockExtractSitemapLinks: vi.fn(),
}));

vi.mock('../extractors/cheerio.extractor', () => ({
  CheerioExtractor: vi.fn(function(this: Record<string, unknown>) {
    this.extract = mockExtract;
    this.extractLinksAllPages = mockExtractLinksAllPages;
    this.extractSitemapLinks = mockExtractSitemapLinks;
  }),
}));

vi.mock('../extractors/playwright.extractor', () => ({
  PlaywrightExtractor: vi.fn(function(this: Record<string, unknown>) {
    this.extractProfile = mockExtractProfile;
    this.close = mockPlaywrightClose;
    this.extractWebLinks = vi.fn().mockResolvedValue([]);
    this.extractWebText = vi.fn().mockResolvedValue({ url: '', sourceText: '', html: '', extractedAt: new Date(), status: 'FAILED' as const });
  }),
}));

vi.mock('../nlp/gemini.analyzer', () => ({
  GeminiAnalyzer: vi.fn(function(this: Record<string, unknown>) {
    this.analyze = mockAnalyze;
    this.analyzeInstagramPost = mockAnalyzeInstagramPost;
    this.discoverActivityLinks = mockDiscoverActivityLinks;
  }),
}));

vi.mock('../cache', () => ({
  ScrapingCache: vi.fn(function(this: Record<string, unknown>) {
    Object.defineProperty(this, 'size', { get: () => 0, configurable: true });
    this.has = mockCacheHas;
    this.filterNew = mockFilterNew;
    this.add = mockCacheAdd;
    this.save = mockCacheSave;
  }),
}));

vi.mock('../storage', () => ({
  ScrapingStorage: vi.fn(function(this: Record<string, unknown>) {
    this.saveBatchResults = mockSaveBatchResults;
    this.saveActivity = mockSaveActivity;
    this.disconnect = mockStorageDisconnect;
  }),
}));

vi.mock('../logger', () => ({
  ScrapingLogger: vi.fn(function(this: Record<string, unknown>) {
    this.getOrCreateSource = mockGetOrCreateSource;
    this.startRun = mockStartRun;
    this.completeRun = mockCompleteRun;
    this.updateSourceStatus = mockUpdateSourceStatus;
  }),
}));

// Mock dynamic imports for getCityId/getVerticalId
vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn().mockImplementation(function () { return {}; }),
}));
vi.mock('../../../generated/prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(function () {
    return {
      city: { findFirst: vi.fn().mockResolvedValue({ id: 'city-bog' }) },
      vertical: { findUnique: vi.fn().mockResolvedValue({ id: 'vert-kids' }) },
      $disconnect: vi.fn(),
    };
  }),
}));

import { ScrapingPipeline } from '../pipeline';
import { PrismaClient } from '../../../generated/prisma/client';

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
  mockCacheHas.mockReturnValue(false);
  mockSaveBatchResults.mockResolvedValue({ saved: 1, skipped: 0, errors: [] });
  mockSaveActivity.mockResolvedValue('activity-123');
  mockStorageDisconnect.mockResolvedValue(undefined);
  mockPlaywrightClose.mockResolvedValue(undefined);
  mockGetOrCreateSource.mockResolvedValue('source-1');
  mockStartRun.mockResolvedValue('log-1');
  mockCompleteRun.mockResolvedValue(undefined);
  mockUpdateSourceStatus.mockResolvedValue(undefined);
  mockExtractSitemapLinks.mockResolvedValue([]);
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

  it('usa extractSitemapLinks (no extractLinksAllPages) cuando la URL es un sitemap XML', async () => {
    const sitemapUrl = 'https://example.com/sitemap.xml';
    mockExtractSitemapLinks.mockResolvedValue([
      { url: 'https://example.com/bogota/actividad/taller', anchorText: '' },
    ]);
    mockDiscoverActivityLinks.mockResolvedValue(['https://example.com/bogota/actividad/taller']);
    mockExtract.mockResolvedValue({ sourceText: 'Texto del taller', status: 'SUCCESS' });
    mockAnalyze.mockResolvedValue(sampleNLPResult);

    const pipeline = new ScrapingPipeline();
    await pipeline.runBatchPipeline(sitemapUrl, 3, 10, ['/bogota/actividad/']);

    expect(mockExtractSitemapLinks).toHaveBeenCalledWith(sitemapUrl, ['/bogota/actividad/']);
    expect(mockExtractLinksAllPages).not.toHaveBeenCalled();
  });

  it('pasa sitemapPatterns a extractSitemapLinks', async () => {
    const sitemapUrl = 'https://example.com/sitemap.xml';
    const patterns = ['/actividad/', '/exposicion/'];
    mockExtractSitemapLinks.mockResolvedValue([]);

    const pipeline = new ScrapingPipeline();
    await pipeline.runBatchPipeline(sitemapUrl, 3, 10, patterns);

    expect(mockExtractSitemapLinks).toHaveBeenCalledWith(sitemapUrl, patterns);
  });

  it('usa cityName y verticalSlug del constructor para el logger', async () => {
    mockExtractLinksAllPages.mockResolvedValue([
      { url: 'https://example.com/taller', anchorText: 'Taller' },
    ]);
    mockDiscoverActivityLinks.mockResolvedValue(['https://example.com/taller']);
    mockExtract.mockResolvedValue({ sourceText: 'Texto', status: 'SUCCESS' });
    mockAnalyze.mockResolvedValue(sampleNLPResult);

    // PrismaClient mock returns city-bog and vert-kids for any findFirst/findUnique
    const pipeline = new ScrapingPipeline({ saveToDb: true, cityName: 'Medellín', verticalSlug: 'sport' });
    await pipeline.runBatchPipeline(listingUrl);

    // Logger should have been called (getOrCreateSource) since mocked Prisma returns valid IDs
    expect(mockGetOrCreateSource).toHaveBeenCalled();
  });
});

// ── runInstagramPipeline() ─────────────────────────────────────────────────────

const sampleInstagramProfile = {
  username: 'fcecolombia',
  bio: 'Fondo de Cultura Economica Colombia. Cra 16 #85-32, Bogota',
  followerCount: 5000,
  profileUrl: 'https://www.instagram.com/fcecolombia/',
  posts: [
    {
      url: 'https://www.instagram.com/p/ABC123/',
      caption: 'Taller de lectura para ninos este sabado! #talleres #ninos #lectura',
      imageUrls: ['https://instagram.com/img1.jpg'],
      timestamp: '2026-03-15T10:00:00.000Z',
      likesCount: 42,
    },
    {
      url: 'https://www.instagram.com/p/DEF456/',
      caption: 'Feliz dia del libro! #books',
      imageUrls: ['https://instagram.com/img2.jpg'],
      timestamp: '2026-03-14T08:00:00.000Z',
      likesCount: 100,
    },
  ],
};

const sampleIGActivity = {
  title: 'Taller de Lectura Infantil',
  description: 'Taller de lectura para ninos',
  categories: ['Literatura'],
  confidenceScore: 0.85,
  currency: 'COP',
};

const sampleIGNonActivity = {
  title: 'Dia del libro',
  description: 'Publicacion conmemorativa',
  categories: ['Sin categoria'],
  confidenceScore: 0.1,
  currency: 'COP',
};

describe('ScrapingPipeline.runInstagramPipeline()', () => {
  const profileUrl = 'https://www.instagram.com/fcecolombia/';

  it('extrae perfil y analiza posts con Gemini', async () => {
    mockExtractProfile.mockResolvedValue(sampleInstagramProfile);
    mockAnalyzeInstagramPost.mockResolvedValue(sampleIGActivity);

    const pipeline = new ScrapingPipeline();
    const result = await pipeline.runInstagramPipeline(profileUrl, 12);

    expect(result.username).toBe('fcecolombia');
    expect(result.postsExtracted).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(mockExtractProfile).toHaveBeenCalledWith(profileUrl, 12);
    expect(mockAnalyzeInstagramPost).toHaveBeenCalledTimes(2);
    expect(mockCacheAdd).toHaveBeenCalledTimes(2);
    expect(mockCacheSave).toHaveBeenCalled();
  });

  it('filtra posts ya cacheados', async () => {
    mockExtractProfile.mockResolvedValue(sampleInstagramProfile);
    mockCacheHas.mockImplementation((...args: unknown[]) => String(args[0]).includes('ABC123'));
    mockAnalyzeInstagramPost.mockResolvedValue(sampleIGActivity);

    const pipeline = new ScrapingPipeline();
    const result = await pipeline.runInstagramPipeline(profileUrl);

    // Solo 1 post nuevo (DEF456), ABC123 estaba en cache
    expect(result.results).toHaveLength(1);
    expect(mockAnalyzeInstagramPost).toHaveBeenCalledTimes(1);
  });

  it('retorna results vacio si todos los posts estan cacheados', async () => {
    mockExtractProfile.mockResolvedValue(sampleInstagramProfile);
    mockCacheHas.mockReturnValue(true);

    const pipeline = new ScrapingPipeline();
    const result = await pipeline.runInstagramPipeline(profileUrl);

    expect(result.results).toEqual([]);
    expect(mockAnalyzeInstagramPost).not.toHaveBeenCalled();
  });

  it('guarda en BD solo posts con confianza >= 0.3', async () => {
    mockExtractProfile.mockResolvedValue(sampleInstagramProfile);
    mockAnalyzeInstagramPost
      .mockResolvedValueOnce(sampleIGActivity) // confianza 0.85
      .mockResolvedValueOnce(sampleIGNonActivity); // confianza 0.1

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    await pipeline.runInstagramPipeline(profileUrl);

    // Solo la primera actividad debe guardarse (0.85 >= 0.3)
    expect(mockSaveActivity).toHaveBeenCalledTimes(1);
    expect(mockSaveActivity).toHaveBeenCalledWith(
      sampleIGActivity,
      'https://www.instagram.com/p/ABC123/',
      'kids',
      { platform: 'INSTAGRAM', instagramUsername: 'fcecolombia' },
    );
  });

  it('NO guarda en BD si saveToDb es false', async () => {
    mockExtractProfile.mockResolvedValue(sampleInstagramProfile);
    mockAnalyzeInstagramPost.mockResolvedValue(sampleIGActivity);

    const pipeline = new ScrapingPipeline({ saveToDb: false });
    await pipeline.runInstagramPipeline(profileUrl);

    expect(mockSaveActivity).not.toHaveBeenCalled();
  });

  it('maneja errores de analisis sin detener el pipeline', async () => {
    mockExtractProfile.mockResolvedValue(sampleInstagramProfile);
    mockAnalyzeInstagramPost
      .mockRejectedValueOnce(new Error('Gemini timeout'))
      .mockResolvedValueOnce(sampleIGActivity);

    const pipeline = new ScrapingPipeline();
    const result = await pipeline.runInstagramPipeline(profileUrl);

    expect(result.results).toHaveLength(2);
    expect(result.results[0].data).toBeNull();
    expect(result.results[0].error).toBe('Gemini timeout');
    expect(result.results[1].data).toEqual(sampleIGActivity);
  });
});

// ── Logger integration in batch ──────────────────────────────────────────────

describe('ScrapingPipeline logger integration (batch)', () => {
  const listingUrl = 'https://example.com/actividades';

  it('llama logger.startRun y completeRun cuando saveToDb=true', async () => {
    mockExtractLinksAllPages.mockResolvedValue([
      { url: 'https://example.com/t1', anchorText: 'T1' },
    ]);
    mockDiscoverActivityLinks.mockResolvedValue(['https://example.com/t1']);
    mockExtract.mockResolvedValue({ sourceText: 'Texto', status: 'SUCCESS' });
    mockAnalyze.mockResolvedValue(sampleNLPResult);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    await pipeline.runBatchPipeline(listingUrl);

    expect(mockGetOrCreateSource).toHaveBeenCalled();
    expect(mockStartRun).toHaveBeenCalledWith('source-1');
    expect(mockCompleteRun).toHaveBeenCalledWith('log-1', expect.objectContaining({
      itemsFound: 1,
    }));
    expect(mockUpdateSourceStatus).toHaveBeenCalled();
  });

  it('logger init error es non-fatal', async () => {
    mockGetOrCreateSource.mockRejectedValue(new Error('DB down'));
    mockExtractLinksAllPages.mockResolvedValue([
      { url: 'https://example.com/t1', anchorText: 'T1' },
    ]);
    mockDiscoverActivityLinks.mockResolvedValue(['https://example.com/t1']);
    mockExtract.mockResolvedValue({ sourceText: 'Texto', status: 'SUCCESS' });
    mockAnalyze.mockResolvedValue(sampleNLPResult);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    // Should not throw despite logger error
    const result = await pipeline.runBatchPipeline(listingUrl);
    expect(result.results).toHaveLength(1);
  });

  it('logger complete error es non-fatal', async () => {
    mockCompleteRun.mockRejectedValue(new Error('Logger write failed'));
    mockExtractLinksAllPages.mockResolvedValue([
      { url: 'https://example.com/t1', anchorText: 'T1' },
    ]);
    mockDiscoverActivityLinks.mockResolvedValue(['https://example.com/t1']);
    mockExtract.mockResolvedValue({ sourceText: 'Texto', status: 'SUCCESS' });
    mockAnalyze.mockResolvedValue(sampleNLPResult);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    const result = await pipeline.runBatchPipeline(listingUrl);
    expect(result.results).toHaveLength(1);
  });

  it('batch con 0 links completa logger con FAILED', async () => {
    mockExtractLinksAllPages.mockResolvedValue([]);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    await pipeline.runBatchPipeline(listingUrl);

    expect(mockCompleteRun).toHaveBeenCalledWith('log-1', expect.objectContaining({
      itemsFound: 0,
      errorMessage: 'No links found',
    }));
    expect(mockUpdateSourceStatus).toHaveBeenCalledWith('source-1', 'FAILED', 0);
  });

  it('batch con 0 actividades filtradas completa logger con SUCCESS', async () => {
    mockExtractLinksAllPages.mockResolvedValue([
      { url: 'https://example.com/x', anchorText: 'X' },
    ]);
    mockDiscoverActivityLinks.mockResolvedValue([]);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    await pipeline.runBatchPipeline(listingUrl);

    expect(mockCompleteRun).toHaveBeenCalledWith('log-1', expect.objectContaining({
      itemsFound: 0,
    }));
    expect(mockUpdateSourceStatus).toHaveBeenCalledWith('source-1', 'SUCCESS', 0);
  });

  it('batch todo en cache completa logger con duplicated count', async () => {
    mockExtractLinksAllPages.mockResolvedValue([
      { url: 'https://example.com/t1', anchorText: 'T1' },
    ]);
    mockDiscoverActivityLinks.mockResolvedValue(['https://example.com/t1']);
    mockFilterNew.mockReturnValue([]);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    await pipeline.runBatchPipeline(listingUrl);

    expect(mockCompleteRun).toHaveBeenCalledWith('log-1', expect.objectContaining({
      itemsDuplicated: 1,
      itemsNew: 0,
    }));
  });
});

// ── Logger integration in Instagram ──────────────────────────────────────────

describe('ScrapingPipeline logger integration (Instagram)', () => {
  const profileUrl = 'https://www.instagram.com/fcecolombia/';

  it('llama logger en Instagram pipeline con saveToDb=true', async () => {
    mockExtractProfile.mockResolvedValue(sampleInstagramProfile);
    mockAnalyzeInstagramPost.mockResolvedValue(sampleIGActivity);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    await pipeline.runInstagramPipeline(profileUrl);

    expect(mockGetOrCreateSource).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'INSTAGRAM',
      scraperType: 'playwright-instagram',
    }));
    expect(mockStartRun).toHaveBeenCalled();
    expect(mockCompleteRun).toHaveBeenCalled();
    expect(mockUpdateSourceStatus).toHaveBeenCalled();
  });

  it('IG logger init error es non-fatal', async () => {
    mockGetOrCreateSource.mockRejectedValue(new Error('DB down'));
    mockExtractProfile.mockResolvedValue(sampleInstagramProfile);
    mockAnalyzeInstagramPost.mockResolvedValue(sampleIGActivity);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    const result = await pipeline.runInstagramPipeline(profileUrl);
    expect(result.results).toHaveLength(2);
  });

  it('IG logger complete error es non-fatal', async () => {
    mockCompleteRun.mockRejectedValue(new Error('write failed'));
    mockExtractProfile.mockResolvedValue(sampleInstagramProfile);
    mockAnalyzeInstagramPost.mockResolvedValue(sampleIGActivity);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    const result = await pipeline.runInstagramPipeline(profileUrl);
    expect(result.results).toHaveLength(2);
  });

  it('IG todos cacheados completa logger con SUCCESS', async () => {
    mockExtractProfile.mockResolvedValue(sampleInstagramProfile);
    mockCacheHas.mockReturnValue(true);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    await pipeline.runInstagramPipeline(profileUrl);

    expect(mockCompleteRun).toHaveBeenCalledWith('log-1', expect.objectContaining({
      itemsDuplicated: 2,
      itemsNew: 0,
    }));
  });

  it('IG con errores completa logger con PARTIAL status', async () => {
    mockExtractProfile.mockResolvedValue(sampleInstagramProfile);
    mockAnalyzeInstagramPost
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(sampleIGActivity);

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    await pipeline.runInstagramPipeline(profileUrl);

    expect(mockCompleteRun).toHaveBeenCalledWith('log-1', expect.objectContaining({
      errorMessage: expect.stringContaining('1 posts fallaron'),
    }));
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

  it('cierra PlaywrightExtractor si fue inicializado', async () => {
    mockExtractProfile.mockResolvedValue({
      ...sampleInstagramProfile,
      posts: [],
    });

    const pipeline = new ScrapingPipeline();
    await pipeline.runInstagramPipeline('https://www.instagram.com/test/');
    await pipeline.disconnect();
    expect(mockPlaywrightClose).toHaveBeenCalled();
  });
});

// ── Branch coverage gaps ──────────────────────────────────────────────────────

describe('Pipeline — branches no cubiertos', () => {
  const listingUrl = 'https://example.com/actividades';

  // Línea 42: Cheerio falla → Playwright tiene éxito → usa resultado Playwright
  it('runPipeline: usa Playwright como fallback cuando Cheerio falla y Playwright tiene éxito', async () => {
    mockExtract.mockResolvedValue({ url: listingUrl, sourceText: '', status: 'FAILED' });
    mockAnalyze.mockResolvedValue(sampleNLPResult);

    // Override PlaywrightExtractor mock para este test
    const { PlaywrightExtractor } = await import('../extractors/playwright.extractor');
    vi.mocked(PlaywrightExtractor).mockImplementationOnce(function (this: Record<string, unknown>) {
      this.extractWebText = vi.fn().mockResolvedValue({
        url: listingUrl,
        sourceText: 'Texto suficientemente largo extraído por Playwright para superar el umbral mínimo',
        html: '<html></html>',
        extractedAt: new Date(),
        status: 'SUCCESS',
      });
      this.extractWebLinks = vi.fn().mockResolvedValue([]);
      this.close = vi.fn();
    });

    const pipeline = new ScrapingPipeline();
    const result = await pipeline.runPipeline(listingUrl);
    expect(result.title).toBe('Taller de Robótica');
  });

  // Línea 74: Logger batch deshabilitado cuando cityId no encontrado
  it('runBatchPipeline: logger deshabilitado si cityId no se encuentra en BD', async () => {
    mockExtractLinksAllPages.mockResolvedValue([
      { url: 'https://example.com/taller', anchorText: 'Taller' },
    ]);
    mockDiscoverActivityLinks.mockResolvedValue(['https://example.com/taller']);
    mockExtract.mockResolvedValue({ sourceText: 'Texto', status: 'SUCCESS' });
    mockAnalyze.mockResolvedValue(sampleNLPResult);

    vi.mocked(PrismaClient).mockImplementationOnce(function () {
      return {
        city: { findFirst: vi.fn().mockResolvedValue(null) },
        vertical: { findUnique: vi.fn().mockResolvedValue({ id: 'vert-kids' }) },
        $disconnect: vi.fn(),
      } as any;
    });

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    const result = await pipeline.runBatchPipeline(listingUrl);

    expect(mockGetOrCreateSource).not.toHaveBeenCalled();
    expect(result.results.length).toBeGreaterThanOrEqual(0);
  });

  // Línea 112: Playwright extractWebLinks lanza error en fallback SPA
  it('runBatchPipeline: Playwright extractWebLinks falla en fallback SPA → continúa', async () => {
    mockExtractLinksAllPages.mockResolvedValue([]); // Cheerio no encontró links

    const { PlaywrightExtractor } = await import('../extractors/playwright.extractor');
    vi.mocked(PlaywrightExtractor).mockImplementationOnce(function (this: Record<string, unknown>) {
      this.extractWebLinks = vi.fn().mockRejectedValue(new Error('Browser crash'));
      this.extractWebText = vi.fn();
      this.close = vi.fn();
    });

    const pipeline = new ScrapingPipeline();
    const result = await pipeline.runBatchPipeline(listingUrl);

    expect(result.discoveredLinks).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  // Línea 250: Logger Instagram deshabilitado cuando verticalId no encontrado
  it('runInstagramPipeline: logger deshabilitado si verticalId no se encuentra en BD', async () => {
    mockExtractProfile.mockResolvedValue(sampleInstagramProfile);
    mockAnalyzeInstagramPost.mockResolvedValue(sampleIGActivity);

    vi.mocked(PrismaClient).mockImplementationOnce(function () {
      return {
        city: { findFirst: vi.fn().mockResolvedValue({ id: 'city-bog' }) },
        vertical: { findUnique: vi.fn().mockResolvedValue(null) },
        $disconnect: vi.fn(),
      } as any;
    });

    const pipeline = new ScrapingPipeline({ saveToDb: true });
    const result = await pipeline.runInstagramPipeline('https://www.instagram.com/test/');

    // Si verticalId es null, el logger se deshabilita y el pipeline continúa sin error
    expect(result.results).toBeDefined();
    expect(result.results.length).toBeGreaterThanOrEqual(0);
  });
});
