import { Worker, type Job } from 'bullmq';
import { getRedisConnection } from './connection';
import { QUEUE_NAME } from './scraping.queue';
import type { ScrapingJobData, ScrapingJobResult } from './types';
import { ScrapingPipeline } from '../pipeline';

// Concurrency = 1: respeta el rate limit de Gemini (20 RPD / 5 RPM)
const WORKER_CONCURRENCY = 1;

async function processJob(
  job: Job<ScrapingJobData, ScrapingJobResult>,
): Promise<ScrapingJobResult> {
  const start = Date.now();
  const { data } = job;

  console.log(`[WORKER] Procesando job ${job.id} — tipo: ${data.type}, url: ${data.url ?? (data as any).profileUrl}`);

  const pipeline = new ScrapingPipeline({
    saveToDb: true,
    cityName: data.cityName,
    verticalSlug: data.verticalSlug,
  });

  if (data.type === 'batch') {
    await job.updateProgress(10);
    const result = await pipeline.runBatchPipeline(data.url, {
      maxPages: data.maxPages,
      sitemapPatterns: data.sitemapPatterns,
    });
    await job.updateProgress(100);

    const saved = result.results.filter((r) => r.data !== null).length;
    const failed = result.results.filter((r) => r.data === null).length;

    return {
      type: 'batch',
      url: data.url,
      discoveredLinks: result.discoveredLinks,
      filteredLinks: result.filteredLinks,
      saved,
      failed,
      durationMs: Date.now() - start,
    };
  }

  // instagram
  await job.updateProgress(10);
  const result = await pipeline.runInstagramPipeline(data.profileUrl);
  await job.updateProgress(100);

  const saved = result.results.filter((r) => r.data !== null).length;
  const failed = result.results.filter((r) => r.data === null).length;

  return {
    type: 'instagram',
    url: data.profileUrl,
    saved,
    failed,
    durationMs: Date.now() - start,
  };
}

export function startScrapingWorker(): Worker<ScrapingJobData, ScrapingJobResult> {
  const worker = new Worker<ScrapingJobData, ScrapingJobResult>(
    QUEUE_NAME,
    processJob,
    {
      connection: getRedisConnection(),
      concurrency: WORKER_CONCURRENCY,
    },
  );

  worker.on('completed', (job, result) => {
    console.log(
      `[WORKER] ✅ Job ${job.id} completado — guardados: ${result.saved}, fallidos: ${result.failed}, tiempo: ${(result.durationMs / 1000).toFixed(1)}s`,
    );
  });

  worker.on('failed', (job, err) => {
    console.error(`[WORKER] ❌ Job ${job?.id} falló (intento ${job?.attemptsMade}): ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error(`[WORKER] Error inesperado: ${err.message}`);
  });

  console.log(`[WORKER] Iniciado. Escuchando queue "${QUEUE_NAME}" (concurrencia: ${WORKER_CONCURRENCY})`);
  return worker;
}
