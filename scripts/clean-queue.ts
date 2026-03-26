// clean-queue.ts — Limpia todos los jobs de la cola de scraping
import 'dotenv/config';
import { getScrapingQueue, closeScrapingQueue, closeRedisConnection } from '../src/modules/scraping/queue';

async function main() {
  const q = getScrapingQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    q.getWaitingCount(), q.getActiveCount(), q.getCompletedCount(),
    q.getFailedCount(), q.getDelayedCount(),
  ]);

  console.log('Estado actual:');
  console.log(`  Waiting:   ${waiting}`);
  console.log(`  Active:    ${active}`);
  console.log(`  Completed: ${completed}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Delayed:   ${delayed}`);
  console.log(`  TOTAL:     ${waiting + active + completed + failed + delayed}`);

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('\n[DRY RUN] No se eliminó nada.');
  } else {
    await q.obliterate({ force: true });
    console.log('\n✅ Cola limpiada completamente.');
  }

  await closeScrapingQueue();
  await closeRedisConnection();
}

main().catch((e) => { console.error(e); process.exit(1); });
