// =============================================================================
// API route para cron job de expiración de actividades
// Llamada por Vercel Cron cada noche a medianoche
// Protegida con CRON_SECRET para evitar llamadas no autorizadas
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { expireActivities } from '@/lib/expire-activities'
import { createLogger } from '@/lib/logger';

const log = createLogger('cron:expire');

export async function GET(req: NextRequest) {
  // Verificar que la llamada viene de Vercel Cron o es autorizada
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const result = await expireActivities()
    log.info('Actividades expiradas', { count: result.expired })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    log.error('expire-activities falló', { error: err })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
