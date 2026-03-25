import { getScrapingQueue } from './scraping.queue';
import type { BatchJobData, InstagramJobData } from './types';

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
  console.log(`[PRODUCER] Job batch encolado: ${job.id} — ${data.url}`);
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
  console.log(`[PRODUCER] Job instagram encolado: ${job.id} — ${data.profileUrl}`);
  return job.id!;
}
