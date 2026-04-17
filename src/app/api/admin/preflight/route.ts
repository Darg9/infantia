// =============================================================================
// GET /api/admin/preflight?from=&to=&limit=
//
// Devuelve stats + filas de date_preflight_logs.
// Schema real: id, source_id, url, raw_date_text, parsed_date,
//              reason, used_fallback, skip, created_at
//
// Razones posibles (preflight-db.ts):
//   process        → enviada a Gemini (no descartada)
//   datetime_past  → capa 1 — atributo datetime HTML
//   text_date_past → capa 2 — fecha en texto plano
//   past_year_only → capa 3a — año pasado sin año actual
//   keyword_past   → capa 3b — keyword de evento finalizado
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// BigInt no es serializable por JSON.stringify directamente
function n(v: unknown): number {
  return typeof v === 'bigint' ? Number(v) : Number(v ?? 0);
}

type StatsRow = {
  total: bigint;
  skipped: bigint;
  processed: bigint;
  fallback_count: bigint;
  r_process: bigint;
  r_datetime_past: bigint;
  r_text_date_past: bigint;
  r_past_year_only: bigint;
  r_keyword_past: bigint;
};

type SourceStatRow = {
  source_id: string | null;
  total: bigint;
  skipped: bigint;
  skip_rate: string; // numeric de PostgreSQL llega como string
};

type RawRow = {
  id: string;
  source_id: string | null;
  url: string;
  raw_date_text: string | null;
  parsed_date: Date | string | null;
  reason: string;
  used_fallback: boolean;
  skip: boolean;
  created_at: Date | string;
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // Defaults: últimos 7 días
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const fromRaw = searchParams.get('from');
  const toRaw   = searchParams.get('to');
  const limitRaw = searchParams.get('limit');

  const fromDate = fromRaw ? new Date(fromRaw) : sevenDaysAgo;
  const toDate   = toRaw   ? new Date(toRaw)   : now;
  const limit    = Math.min(Math.max(1, parseInt(limitRaw ?? '100', 10) || 100), 500);

  // ── Stats (sin LIMIT) ──────────────────────────────────────────────────────
  const [statsRows, sourceRows, rows] = await Promise.all([
    prisma.$queryRaw<StatsRow[]>`
      SELECT
        COUNT(*)                                                 AS total,
        COUNT(*) FILTER (WHERE skip = true)                     AS skipped,
        COUNT(*) FILTER (WHERE skip = false)                    AS processed,
        COUNT(*) FILTER (WHERE used_fallback = true)            AS fallback_count,
        COUNT(*) FILTER (WHERE reason = 'process')              AS r_process,
        COUNT(*) FILTER (WHERE reason = 'datetime_past')        AS r_datetime_past,
        COUNT(*) FILTER (WHERE reason = 'text_date_past')       AS r_text_date_past,
        COUNT(*) FILTER (WHERE reason = 'past_year_only')       AS r_past_year_only,
        COUNT(*) FILTER (WHERE reason = 'keyword_past')         AS r_keyword_past
      FROM date_preflight_logs
      WHERE created_at >= ${fromDate} AND created_at <= ${toDate}
    `,
    // Agregación por fuente (top 15, ordenado por total DESC)
    prisma.$queryRaw<SourceStatRow[]>`
      SELECT
        COALESCE(source_id, '(sin fuente)')   AS source_id,
        COUNT(*)                               AS total,
        COUNT(*) FILTER (WHERE skip = true)    AS skipped,
        CASE WHEN COUNT(*) = 0 THEN 0
             ELSE ROUND(COUNT(*) FILTER (WHERE skip = true)::numeric / COUNT(*) * 100, 1)
        END                                    AS skip_rate
      FROM date_preflight_logs
      WHERE created_at >= ${fromDate} AND created_at <= ${toDate}
      GROUP BY source_id
      ORDER BY total DESC
      LIMIT 15
    `,
    prisma.$queryRaw<RawRow[]>`
      SELECT
        id::text,
        source_id,
        url,
        raw_date_text,
        parsed_date,
        reason,
        used_fallback,
        skip,
        created_at
      FROM date_preflight_logs
      WHERE created_at >= ${fromDate} AND created_at <= ${toDate}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `,
  ]);

  const s = statsRows[0] ?? ({} as StatsRow);
  const total = n(s.total);

  const stats = {
    total,
    skipped:   n(s.skipped),
    processed: n(s.processed),
    skipRate:  total > 0 ? Math.round((n(s.skipped)   / total) * 100) : 0,
    processRate: total > 0 ? Math.round((n(s.processed) / total) * 100) : 0,
    fallbackCount: n(s.fallback_count),
    fallbackRate:  total > 0 ? Math.round((n(s.fallback_count) / total) * 100) : 0,
    byReason: {
      process:        n(s.r_process),
      datetime_past:  n(s.r_datetime_past),
      text_date_past: n(s.r_text_date_past),
      past_year_only: n(s.r_past_year_only),
      keyword_past:   n(s.r_keyword_past),
    },
  };

  // Serializar Dates + convertir BigInt en sourceRows
  const serializedRows = rows.map((r) => ({
    ...r,
    parsed_date:
      r.parsed_date instanceof Date ? r.parsed_date.toISOString().split('T')[0] : r.parsed_date,
    created_at:
      r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  }));

  const bySource = sourceRows.map((r) => ({
    sourceId:  r.source_id,
    total:     n(r.total),
    skipped:   n(r.skipped),
    skipRate:  parseFloat(String(r.skip_rate)),
  }));

  return NextResponse.json({ stats, bySource, rows: serializedRows, limit });
}
