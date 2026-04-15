import { getScrapingQueue } from './scraping.queue';
import type { BatchJobData, InstagramJobData } from './types';
import { createLogger } from '../../../lib/logger';

// Shape mínimo de una ScrapingSource para encolado por el cron
export interface SourceJobInput {
  sourceId:    string;
  url:         string;
  platform:    string;   // 'INSTAGRAM' | 'WEBSITE' | ...
  cityName:    string;
  verticalSlug: string;
  maxPages?:   number;
}

const log = createLogger('scraping:producer');

export async function enqueueBatchJob(
  data: Omit<BatchJobData, 'type'>,
  opts?: { delay?: number; priority?: number },
): Promise<string> {
  const queue = getScrapingQueue();
  const job = await queue.add(
    'batch',
    { type: 'batch', ...data },
    { delay: opts?.delay, priority: opts?.priority },
  );
  log.info(`Job batch encolado: ${job.id} — ${data.url}`);
  return job.id!;
}

export async function enqueueInstagramJob(
  data: Omit<InstagramJobData, 'type'>,
  opts?: { delay?: number; priority?: number },
): Promise<string> {
  const queue = getScrapingQueue();
  const job = await queue.add(
    'instagram',
    { type: 'instagram', ...data },
    { delay: opts?.delay, priority: opts?.priority },
  );
  log.info(`Job instagram encolado: ${job.id} — ${data.profileUrl}`);
  return job.id!;
}

/**
 * enqueueSourceJob — usado por el cron scheduler.
 *
 * Encola el job correcto según platform y garantiza idempotencia con
 * jobId = sourceId (BullMQ ignora duplicados si el job ya está en cola).
 */
export async function enqueueSourceJob(source: SourceJobInput): Promise<string> {
  const queue = getScrapingQueue();
  const { sourceId, url, platform, cityName, verticalSlug, maxPages } = source;

  if (platform === 'INSTAGRAM') {
    const job = await queue.add(
      'instagram',
      { type: 'instagram', profileUrl: url, cityName, verticalSlug },
      { jobId: sourceId },
    );
    log.info(`Cron: job instagram encolado — ${sourceId}`);
    return job.id!;
  }

  // Default: batch (WEBSITE, TELEGRAM, FACEBOOK, etc.)
  const job = await queue.add(
    'batch',
    { type: 'batch', url, cityName, verticalSlug, maxPages },
    { jobId: sourceId },
  );
  log.info(`Cron: job batch encolado — ${sourceId}`);
  return job.id!;
}
