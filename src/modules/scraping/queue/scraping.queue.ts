import { Queue } from 'bullmq';
import { getRedisConnection } from './connection';
import type { ScrapingJobData, ScrapingJobResult } from './types';

export const QUEUE_NAME = 'scraping';

let queue: Queue<ScrapingJobData, ScrapingJobResult> | null = null;

export function getScrapingQueue(): Queue<ScrapingJobData, ScrapingJobResult> {
  if (!queue) {
    queue = new Queue<ScrapingJobData, ScrapingJobResult>(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return queue;
}

export async function closeScrapingQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
