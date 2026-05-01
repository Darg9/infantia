import { getErrorMessage } from '../../../../../lib/error';
// GET /api/admin/sources/url-stats
// Obtiene estadísticas de URL scores para el dashboard de admin

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSourceDashboardStats } from '@/lib/source-pause-manager';
import { createLogger } from '@/lib/logger';
import { UserRole } from '@/generated/prisma/client';

const log = createLogger('api:admin:sources:url-stats');

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Solo ADMIN puede acceder
    if (session.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Query params
    const searchParams = request.nextUrl.searchParams;
    const cityId = searchParams.get('cityId') || undefined;

    log.info(`Fetching source dashboard stats${cityId ? ` for city ${cityId}` : ''}`);

    const stats = await getSourceDashboardStats(cityId);

    // Transformar datos para el frontend
    const formatted = stats.map((s) => ({
      id: s.id,
      name: s.name,
      platform: s.platform,
      cityName: s.city_name,
      cityId: s.city_id,
      urlScore: s.avg_url_score ? Math.round(parseFloat(String(s.avg_url_score)) * 10) / 10 : null,
      lowScoreCount: Number(s.low_score_count || 0),
      highScoreCount: Number(s.high_score_count || 0),
      totalUrls: Number(s.total_urls_processed || 0),
      lastScanned: s.last_scan_at ? new Date(s.last_scan_at).toISOString() : null,
      paused: !!s.paused_at,
      pausedAt: s.paused_at ? new Date(s.paused_at).toISOString() : null,
      pausedReason: s.paused_reason,
      pauseThreshold: s.pause_threshold_score || 20,
      pauseDurationDays: s.pause_duration_days || 7,
      isActive: s.is_active,
    }));

    // Agrupar por estado
    const summary = {
      total: formatted.length,
      active: formatted.filter((s) => s.isActive).length,
      paused: formatted.filter((s) => s.paused).length,
      lowQuality: formatted.filter((s) => s.urlScore && s.urlScore < 45).length,
    };

    return NextResponse.json({
      summary,
      sources: formatted,
    });
  } catch (error: unknown) {
    log.error('Error fetching source stats', { error });
    return NextResponse.json(
      { error: getErrorMessage(error) || 'Error fetching source stats' },
      { status: 500 },
    );
  }
}
