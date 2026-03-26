import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

let capturedProcessor: ((job: any) => Promise<any>) | null = null;
let capturedEventHandlers: Record<string, (...args: any[]) => void> = {};

const mockWorkerOn = vi.fn((event: string, handler: (...args: any[]) => void) => {
  capturedEventHandlers[event] = handler;
  return mockWorkerInstance;
});
const mockWorkerClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerInstance = { on: mockWorkerOn, close: mockWorkerClose };

vi.mock('bullmq', () => ({
  Worker: vi.fn(function (_name: string, processor: (job: any) => Promise<any>, _opts: any) {
    capturedProcessor = processor;
    return mockWorkerInstance;
  }),
}));

vi.mock('../queue/connection', () => ({
  getRedisConnection: vi.fn(() => ({ quit: vi.fn() })),
}));

const mockRunBatchPipeline = vi.fn();
const mockRunInstagramPipeline = vi.fn();

vi.mock('../pipeline', () => ({
  ScrapingPipeline: vi.fn(function () {
    return {
      runBatchPipeline: mockRunBatchPipeline,
      runInstagramPipeline: mockRunInstagramPipeline,
    };
  }),
}));

import { startScrapingWorker } from '../queue/scraping.worker';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeJob(data: Record<string, unknown>, id = 'job-1') {
  return {
    id,
    data,
    updateProgress: vi.fn().mockResolvedValue(undefined),
    attemptsMade: 1,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('scraping.worker — startScrapingWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProcessor = null;
    capturedEventHandlers = {};
  });

  it('crea y retorna un Worker', () => {
    const worker = startScrapingWorker();
    expect(worker).toBe(mockWorkerInstance);
  });

  it('registra handlers para completed, failed y error', () => {
    startScrapingWorker();
    expect(mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function));
    expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
    expect(mockWorkerOn).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('handler "completed" no lanza errores', () => {
    startScrapingWorker();
    const handler = capturedEventHandlers['completed'];
    expect(() =>
      handler({ id: 'job-1' }, { saved: 5, failed: 0, durationMs: 1200 }),
    ).not.toThrow();
  });

  it('handler "failed" no lanza errores', () => {
    startScrapingWorker();
    const handler = capturedEventHandlers['failed'];
    expect(() =>
      handler({ id: 'job-1', attemptsMade: 2 }, new Error('timeout')),
    ).not.toThrow();
  });

  it('handler "failed" con job null no lanza errores', () => {
    startScrapingWorker();
    const handler = capturedEventHandlers['failed'];
    expect(() => handler(null, new Error('crash'))).not.toThrow();
  });

  it('handler "error" no lanza errores', () => {
    startScrapingWorker();
    const handler = capturedEventHandlers['error'];
    expect(() => handler(new Error('unexpected'))).not.toThrow();
  });
});

describe('scraping.worker — processJob (tipo batch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProcessor = null;
    capturedEventHandlers = {};
    mockRunBatchPipeline.mockResolvedValue({
      discoveredLinks: 10,
      filteredLinks: 5,
      results: [
        { data: { title: 'Actividad 1' } },
        { data: null },
        { data: { title: 'Actividad 2' } },
      ],
    });
  });

  it('procesa job batch y retorna resultado correcto', async () => {
    startScrapingWorker();
    const job = makeJob({
      type: 'batch',
      url: 'https://example.com/agenda',
      cityName: 'Bogotá',
      verticalSlug: 'kids',
      maxPages: 5,
      sitemapPatterns: [],
    });

    const result = await capturedProcessor!(job);

    expect(result.type).toBe('batch');
    expect(result.url).toBe('https://example.com/agenda');
    expect(result.saved).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.discoveredLinks).toBe(10);
    expect(result.filteredLinks).toBe(5);
    expect(typeof result.durationMs).toBe('number');
  });

  it('llama updateProgress en job batch', async () => {
    startScrapingWorker();
    const job = makeJob({
      type: 'batch',
      url: 'https://example.com/agenda',
      cityName: 'Bogotá',
      verticalSlug: 'kids',
    });

    await capturedProcessor!(job);

    expect(job.updateProgress).toHaveBeenCalledWith(10);
    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });
});

describe('scraping.worker — processJob (tipo instagram)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProcessor = null;
    capturedEventHandlers = {};
    mockRunInstagramPipeline.mockResolvedValue({
      results: [
        { data: { title: 'Post 1' } },
        { data: { title: 'Post 2' } },
        { data: null },
      ],
    });
  });

  it('procesa job instagram y retorna resultado correcto', async () => {
    startScrapingWorker();
    const job = makeJob({
      type: 'instagram',
      profileUrl: 'https://www.instagram.com/fcecolombia/',
      cityName: 'Bogotá',
      verticalSlug: 'kids',
    });

    const result = await capturedProcessor!(job);

    expect(result.type).toBe('instagram');
    expect(result.url).toBe('https://www.instagram.com/fcecolombia/');
    expect(result.saved).toBe(2);
    expect(result.failed).toBe(1);
    expect(typeof result.durationMs).toBe('number');
  });

  it('llama updateProgress en job instagram', async () => {
    startScrapingWorker();
    const job = makeJob({
      type: 'instagram',
      profileUrl: 'https://www.instagram.com/fcecolombia/',
      cityName: 'Bogotá',
      verticalSlug: 'kids',
    });

    await capturedProcessor!(job);

    expect(job.updateProgress).toHaveBeenCalledWith(10);
    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });
});
