// =============================================================================
// GET /api/activities/suggestions?q=texto
//
// Devuelve hasta 5 sugerencias mixtas: actividades, categorías, ciudades.
// Ranking por tipo: similitud pg_trgm > prefix > popularidad.
// Orden de mezcla: actividades primero, luego categorías, luego ciudades.
// Mínimo 3 caracteres.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizeSearchQuery } from '@/lib/search';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:suggestions');

export type SuggestionType = 'activity' | 'category' | 'city';

export interface SuggestionItem {
  type: SuggestionType;
  id: string;
  label: string;
  sublabel: string | null;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (q.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const qNorm = normalizeSearchQuery(q);
  const term  = qNorm.length > 0 ? qNorm : q.toLowerCase();

  try {
    log.info('Búsqueda de sugerencia', { action: 'suggestion_attempt', query: q, normalized: term });

    // ── Actividades: pg_trgm similarity + word_similarity ──────────────────
    const actRows = await prisma.$queryRaw<{
      id: string;
      title: string;
      cat_name: string | null;
      score: number;
    }[]>`
      SELECT
        a.id,
        a.title,
        (
          SELECT c2.name
          FROM "ActivityCategory" ac2
          JOIN "Category" c2 ON c2.id = ac2."categoryId"
          WHERE ac2."activityId" = a.id
          LIMIT 1
        ) AS cat_name,
        GREATEST(
          similarity(a.title, ${term}),
          word_similarity(${term}, a.title)
        ) AS score
      FROM activities a
      WHERE
        a.status = 'ACTIVE'
        AND (
          similarity(a.title, ${term}) > 0.12
          OR word_similarity(${term}, a.title) > 0.20
          OR a.title ILIKE ${`%${term}%`}
        )
      ORDER BY score DESC, a."sourceConfidence" DESC NULLS LAST
      LIMIT 8
    `;

    const rankedActivities: SuggestionItem[] = actRows.slice(0, 3).map((a) => ({
      type: 'activity',
      id:   a.id,
      label: a.title,
      sublabel: a.cat_name ?? null,
    }));

    // ── Categorías: Prisma (tabla pequeña, ILIKE suficiente) ───────────────
    const catRows = await prisma.category.findMany({
      where: {
        name: { contains: term, mode: 'insensitive' },
        activities: { some: { activity: { status: 'ACTIVE' } } },
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            activities: { where: { activity: { status: 'ACTIVE' } } },
          },
        },
      },
      orderBy: { name: 'asc' },
      take: 5,
    });

    const rankedCategories: SuggestionItem[] = catRows
      .sort((a, b) => {
        const aPrefix = a.name.toLowerCase().startsWith(term) ? 1 : 0;
        const bPrefix = b.name.toLowerCase().startsWith(term) ? 1 : 0;
        if (aPrefix !== bPrefix) return bPrefix - aPrefix;
        return b._count.activities - a._count.activities;
      })
      .slice(0, 1)
      .map((c) => ({
        type: 'category',
        id:   c.id,
        label: c.name,
        sublabel: `${c._count.activities} actividad${c._count.activities !== 1 ? 'es' : ''}`,
      }));

    // ── Ciudades: Prisma (pocas filas) ─────────────────────────────────────
    const cityRows = await prisma.city.findMany({
      where: {
        name: { contains: term, mode: 'insensitive' },
        locations: { some: { activities: { some: { status: 'ACTIVE' } } } },
      },
      select: { id: true, name: true },
      take: 3,
    });

    const rankedCities: SuggestionItem[] = cityRows
      .sort((a, b) => {
        const aP = a.name.toLowerCase().startsWith(term) ? 1 : 0;
        const bP = b.name.toLowerCase().startsWith(term) ? 1 : 0;
        return bP - aP;
      })
      .slice(0, 1)
      .map((c) => ({
        type: 'city',
        id:   c.id,
        label: c.name,
        sublabel: null,
      }));

    const suggestions = [
      ...rankedActivities,
      ...rankedCategories,
      ...rankedCities,
    ].slice(0, 5);

    return NextResponse.json({ suggestions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    log.error('Error en suggestions', { error: err instanceof Error ? err : new Error(message) });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
