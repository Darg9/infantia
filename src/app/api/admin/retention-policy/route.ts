import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
// Vercel cron limitation: max duration is usually 10s on hobby, 60s on pro. This should be fast.
export const maxDuration = 60; 

const log = createLogger('api:retention-policy');

export async function GET(request: Request) {
  // Verificación de seguridad mínima para evitar abusos públicos
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  log.info('Iniciando ejecución de política de retención SIC...');
  const now = new Date();

  try {
    // 1. Borrar SearchLogs > 90 días
    const searchLogCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const deletedSearchLogs = await prisma.searchLog.deleteMany({
      where: { searchedAt: { lt: searchLogCutoff } }
    });

    // 2. Anonimizar IPs en Eventos > 365 días
    const eventCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
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

    // 3. Anonimizar IPs en ContactRequest > 365 días
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

    // 4. Borrar ContactRequests condicionalmente
    const pqrs24Months = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
    const pqrs36Months = new Date(now.getTime() - 1095 * 24 * 60 * 60 * 1000);

    // Borrar PQRS normales cerrados hace > 24 meses
    const deletedNormalContactRequests = await prisma.contactRequest.deleteMany({
      where: { 
        createdAt: { lt: pqrs24Months },
        status: 'closed',
        category: { not: 'data_claim' }
      }
    });

    // Borrar PQRS complejos (reclamos) cerrados hace > 36 meses
    const deletedComplexContactRequests = await prisma.contactRequest.deleteMany({
      where: { 
        createdAt: { lt: pqrs36Months },
        status: 'closed',
        category: 'data_claim'
      }
    });

    const totalDeletedPqrs = deletedNormalContactRequests.count + deletedComplexContactRequests.count;

    // 5. Borrar ScrapingLogs > 90 días
    const deletedScrapingLogs = await prisma.scrapingLog.deleteMany({
      where: { startedAt: { lt: searchLogCutoff } }
    });

    log.info('Política de retención ejecutada con éxito', {
      searchLogsDeleted: deletedSearchLogs.count,
      eventsAnonymized: anonymizedEvents.count,
      contactRequestsAnonymized: anonymizedContactRequests.count,
      contactRequestsDeleted: totalDeletedPqrs,
      scrapingLogsDeleted: deletedScrapingLogs.count,
    });

    return NextResponse.json({
      success: true,
      stats: {
        searchLogsDeleted: deletedSearchLogs.count,
        eventsAnonymized: anonymizedEvents.count,
        contactRequestsAnonymized: anonymizedContactRequests.count,
        contactRequestsDeleted: totalDeletedPqrs,
        scrapingLogsDeleted: deletedScrapingLogs.count,
      }
    });

  } catch (error) {
    log.error('Error ejecutando política de retención', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Fallo interno en retención' }, { status: 500 });
  }
}
