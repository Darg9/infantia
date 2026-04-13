import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import "dotenv/config";
import { getDomainFromUrl } from '../src/modules/activities/ranking';
import { createLogger } from '../src/lib/logger';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const log = createLogger('backfill:source-domain');

async function main() {
  log.info('Iniciando Backfill de Source Domain en la Base de Datos...');

  const chunkSize = 500;
  let cursorStr: string | undefined = undefined;
  let processed = 0;
  let updated = 0;

  while (true) {
    const records: any[] = await prisma.activity.findMany({
      take: chunkSize,
      skip: cursorStr ? 1 : 0,
      ...(cursorStr ? { cursor: { id: cursorStr } } : {}),
      select: { id: true, sourceUrl: true, sourceDomain: true }
    });

    if (records.length === 0) break;

    const updates: Promise<any>[] = [];

    for (const r of records) {
      if (r.sourceUrl && !r.sourceDomain) {
        const domain = getDomainFromUrl(r.sourceUrl);
        if (domain) {
          updates.push(
            prisma.activity.update({
              where: { id: r.id },
              data: { sourceDomain: domain }
            })
          );
          updated++;
        }
      }
    }

    if (updates.length > 0) {
       await Promise.all(updates);
    }

    processed += records.length;
    cursorStr = records[records.length - 1].id;
    
    log.info(`[Progreso] Procesados: ${processed} | Actualizados: ${updated}...`);
  }

  log.info(`✅ Backfill finalizado exitosamente. Total procesadas: ${processed}. Actualizadas: ${updated}`);
  await prisma.$disconnect();
}

main();
