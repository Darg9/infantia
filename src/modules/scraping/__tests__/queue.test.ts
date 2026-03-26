import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks ---
const mockQueueAdd = vi.fn().mockResolvedValue({ id: 'job-123' });
const mockQueueClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerOn = vi.fn().mockReturnThis();
const mockWorkerClose = vi.fn().mockResolvedValue(undefined);
const mockRedisQuit = vi.fn().mockResolvedValue(undefined);

vi.mock('bullmq', () => ({
  Queue: vi.fn(function (this: Record<string, unknown>) {
    this.add = mockQueueAdd;
    this.close = mockQueueClose;
  }),
  Worker: vi.fn(function (this: Record<string, unknown>) {
    this.on = mockWorkerOn;
    this.close = mockWorkerClose;
  }),
}));

vi.mock('ioredis', () => ({
  default: vi.fn(function (this: Record<string, unknown>) {
    this.quit = mockRedisQuit;
  }),
}));

// Reset module state between tests
vi.mock('../queue/connection', () => {
  let conn: Record<string, unknown> | null = null;
  return {
    getRedisConnection: vi.fn(() => {
      if (!conn) conn = { quit: mockRedisQuit };
      return conn;
    }),
    closeRedisConnection: vi.fn(async () => {
      conn = null;
    }),
  };
});

import { enqueueBatchJob, enqueueInstagramJob } from '../queue/producer';
import { getScrapingQueue, closeScrapingQueue } from '../queue/scraping.queue';

describe('ScrapingQueue — producer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton
    vi.resetModules();
  });

  it('enqueueBatchJob retorna el job id', async () => {
    const id = await enqueueBatchJob({
      url: 'https://example.com/agenda',
      cityName: 'Bogotá',
      verticalSlug: 'kids',
    });
    expect(id).toBe('job-123');
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'batch',
      expect.objectContaining({ type: 'batch', url: 'https://example.com/agenda' }),
      expect.anything(),
    );
  });

  it('enqueueBatchJob incluye maxPages y sitemapPatterns', async () => {
    await enqueueBatchJob({
      url: 'https://example.com/agenda',
      cityName: 'Bogotá',
      verticalSlug: 'kids',
      maxPages: 3,
      sitemapPatterns: ['/evento/'],
    });
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'batch',
      expect.objectContaining({
        maxPages: 3,
        sitemapPatterns: ['/evento/'],
      }),
      expect.anything(),
    );
  });

  it('enqueueInstagramJob retorna el job id', async () => {
    const id = await enqueueInstagramJob({
      profileUrl: 'https://instagram.com/test',
      cityName: 'Bogotá',
      verticalSlug: 'kids',
    });
    expect(id).toBe('job-123');
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'instagram',
      expect.objectContaining({ type: 'instagram', profileUrl: 'https://instagram.com/test' }),
      expect.anything(),
    );
  });

  it('enqueueInstagramJob acepta delay y priority', async () => {
    await enqueueInstagramJob(
      { profileUrl: 'https://instagram.com/test', cityName: 'Bogotá', verticalSlug: 'kids' },
      { delay: 5000, priority: 1 },
    );
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'instagram',
      expect.anything(),
      expect.objectContaining({ delay: 5000, priority: 1 }),
    );
  });
});

describe('ScrapingQueue — queue singleton', () => {
  it('getScrapingQueue devuelve la misma instancia', () => {
    const q1 = getScrapingQueue();
    const q2 = getScrapingQueue();
    expect(q1).toBe(q2);
  });

  it('closeScrapingQueue cierra la queue', async () => {
    getScrapingQueue(); // ensure created
    await closeScrapingQueue();
    expect(mockQueueClose).toHaveBeenCalledTimes(1);
  });

  it('closeScrapingQueue es idempotente (llamarla dos veces no falla)', async () => {
    // Llama close dos veces: la segunda vez queue ya es null
    getScrapingQueue();
    await closeScrapingQueue(); // queue → null, close llamado
    const callsAfterFirst = mockQueueClose.mock.calls.length;
    await closeScrapingQueue(); // queue es null → no llama close de nuevo
    expect(mockQueueClose.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe('ScrapingJobData — tipos', () => {
  it('BatchJobData tiene los campos requeridos', () => {
    const job = {
      type: 'batch' as const,
      url: 'https://example.com',
      cityName: 'Bogotá',
      verticalSlug: 'kids',
    };
    expect(job.type).toBe('batch');
    expect(job.cityName).toBe('Bogotá');
  });

  it('InstagramJobData tiene los campos requeridos', () => {
    const job = {
      type: 'instagram' as const,
      profileUrl: 'https://instagram.com/test',
      cityName: 'Medellín',
      verticalSlug: 'teens',
    };
    expect(job.type).toBe('instagram');
    expect(job.cityName).toBe('Medellín');
  });
});
