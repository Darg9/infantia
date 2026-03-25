// run-worker.ts
// Proceso worker que consume la cola de scraping en Redis/BullMQ.
// Uso: npx tsx scripts/run-worker.ts
//
// Flujo típico:
//   Terminal 1: npx tsx scripts/run-worker.ts
//   Terminal 2: npx tsx scripts/ingest-sources.ts --queue --max-pages=5

import 'dotenv/config';
import { startScrapingWorker, closeRedisConnection } from '../src/modules/scraping/queue';

const worker = startScrapingWorker();

console.log('[WORKER] Esperando jobs... (Ctrl+C para detener)\n');

async function shutdown() {
  console.log('\n[WORKER] Deteniendo...');
  await worker.close();
  await closeRedisConnection();
  console.log('[WORKER] Cerrado limpiamente.');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
