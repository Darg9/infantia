// =============================================================================
// GET /api/admin/cities/review
// Lista entradas pendientes de city_review_queue (resolved=false),
// con JOIN a cities para obtener el nombre de la ciudad sugerida.
// Ordenadas por similarity_score ASC (más dudosas primero). Límite: 50.
// =============================================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type RawRow = {
  id: string;
  raw_input: string;
  normalized_input: string;
  suggested_city_id: string | null;
  suggested_city_name: string | null;
  similarity_score: number | string;
  created_at: Date | string;
};

export async function GET() {
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      crq.id::text,
      crq.raw_input,
      crq.normalized_input,
      crq.suggested_city_id::text,
      c.name AS suggested_city_name,
      crq.similarity_score,
      crq.created_at
    FROM city_review_queue crq
    LEFT JOIN cities c ON c.id = crq.suggested_city_id
    WHERE crq.resolved = false
    ORDER BY crq.similarity_score ASC
    LIMIT 50
  `;

  const serialized = rows.map((r) => ({
    ...r,
    similarity_score: Number(r.similarity_score),
    created_at:
      r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  }));

  return NextResponse.json(serialized);
}
