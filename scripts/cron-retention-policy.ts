import { prisma } from '../src/lib/db';
import { createLogger } from '../src/lib/logger';

const log = createLogger('cron:retention-policy');

async function main() {
  log.info('Iniciando ejecución de política de retención SIC...');

  const now = new Date();

  // 1. Borrar SearchLogs mayores a 90 días
  const searchLogCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const deletedSearchLogs = await prisma.searchLog.deleteMany({
    where: { searchedAt: { lt: searchLogCutoff } }
  });
  log.info(`SearchLogs eliminados (> 90 días): ${deletedSearchLogs.count}`);

  // 2. Anonimizar IPs en Eventos mayores a 365 días
  const eventCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  // Prisma no tiene updateMany con valores nulos directo si no se permite o si queremos un hash, pero podemos poner "[ANONYMIZED]"
  const anonymizedEvents = await prisma.event.updateMany({
    where: { 
      createdAt: { lt: eventCutoff },
      ip: { not: null, not: '[ANONYMIZED]' }
    },
    data: { 
      ip: '[ANONYMIZED]',
      userAgent: '[ANONYMIZED]'
    }
  });
  log.info(`Eventos anonimizados (> 365 días): ${anonymizedEvents.count}`);

  // 3. Anonimizar IPs en ContactRequest mayores a 365 días
  const anonymizedContactRequests = await prisma.contactRequest.updateMany({
    where: {
      createdAt: { lt: eventCutoff },
      ip: { not: null, not: '[ANONYMIZED]' }
    },
    data: {
      ip: '[ANONYMIZED]',
      userAgent: '[ANONYMIZED]'
    }
  });
  log.info(`ContactRequests anonimizados (> 365 días): ${anonymizedContactRequests.count}`);

  // 4. Borrar ContactRequests mayores a 2 años (730 días)
  const contactRequestCutoff = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
  const deletedContactRequests = await prisma.contactRequest.deleteMany({
    where: { createdAt: { lt: contactRequestCutoff } }
  });
  log.info(`ContactRequests eliminados (> 2 años): ${deletedContactRequests.count}`);

  // 5. Borrar ScrapingLogs mayores a 90 días
  const deletedScrapingLogs = await prisma.scrapingLog.deleteMany({
    where: { startedAt: { lt: searchLogCutoff } }
  });
  log.info(`ScrapingLogs eliminados (> 90 días): ${deletedScrapingLogs.count}`);

  log.info('Política de retención ejecutada con éxito.');
}

main()
  .catch((e) => {
    log.error('Error ejecutando política de retención', { error: e instanceof Error ? e.message : String(e) });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
