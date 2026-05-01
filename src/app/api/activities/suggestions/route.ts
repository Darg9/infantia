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
import { normalizeQuery } from '@/modules/activities/search-normalizer';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:suggestions');

export type SuggestionType = 'query' | 'activity' | 'category' | 'city';

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
  // Aplicamos normalización fuerte (nfd, stop-words, 3 tokens) para pg_trgm
  const strongTerm = normalizeQuery(q);
  const useStrongTerm = strongTerm.length > 0 && strongTerm !== term;
  
  try {
    log.info('Búsqueda de sugerencia', { action: 'suggestion_attempt', query: q, normalized: term, strongTerm });

    // Helper para buscar actividades y poder reusarlo en el fallback
    const searchActivities = async (searchTerm: string) => {
      return await prisma.$queryRaw<{
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
            FROM activity_categories ac2
            JOIN categories c2 ON c2.id = ac2."categoryId"
            WHERE ac2."activityId" = a.id
            LIMIT 1
          ) AS cat_name,
          GREATEST(
            similarity(a.title, ${searchTerm}),
            word_similarity(${searchTerm}, a.title)
          ) +
          CASE WHEN a.title ILIKE ${searchTerm + '%'} THEN 0.10 ELSE 0 END
          AS score
        FROM activities a
        WHERE
          a.status = 'ACTIVE'
          AND (
            similarity(a.title, ${searchTerm}) > 0.25
            OR word_similarity(${searchTerm}, a.title) > 0.30
            OR a.title ILIKE ${`%${searchTerm}%`}
          )
        ORDER BY score DESC, a."sourceConfidence" DESC NULLS LAST
        LIMIT 8
      `;
    };

    // ── Actividades: pg_trgm similarity + word_similarity ──────────────────
    let actRows = await searchActivities(useStrongTerm ? strongTerm : term);
    
    // Fallback progresivo si la búsqueda fuerte no da resultados
    let usedFallback = false;
    if (actRows.length === 0 && useStrongTerm) {
      usedFallback = true;
      log.info('Fallback progresivo a query original', { strongTerm, originalTerm: term });
      actRows = await searchActivities(term);
    }

    // Telemetría temporal para calibrar agresividad del normalizador
    log.info('Métrica SearchAssist', { 
      query: q, 
      queryLength: q.split(/\s+/).length,
      usedFallback, 
      resultsCount: actRows.length 
    });

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

    // ── Queries Históricas (SearchLog) ─────────────────────────────────────
    // Modelo de 2 capas: lectura filtrada por calidad
    const logRows = await prisma.searchLog.groupBy({
      by: ['query'],
      where: {
        query: { startsWith: term, mode: 'insensitive' },
      },
      _count: { query: true },
      having: {
        // Filtrar typos: solo consultas frecuentes (count >= 3).
        // A FUTURO (Fase 2): Permitir (_count >= 2 AND updatedAt > NOW() - 24h) para no penalizar tendencias.
        // (La lógica de CTR se añadirá cuando se extienda el esquema para medir clicks)
        query: {
          _count: {
            gte: 3
          }
        }
      },
      orderBy: { _count: { query: 'desc' } },
      take: 5,
    });

    const rankedQueries: SuggestionItem[] = logRows.map((q) => ({
      type: 'query',
      id: q.query,
      label: q.query,
      sublabel: null,
    }));

    const merged = [
      ...rankedQueries,
      ...rankedActivities,
      ...rankedCategories,
      ...rankedCities,
    ];

    const seen = new Set<string>();
    const final = merged.filter((s) => {
      const key = `${s.type}-${s.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const suggestions = final.slice(0, 8);

    return NextResponse.json({ suggestions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    log.error('Error en suggestions', { error: err instanceof Error ? err : new Error(message) });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
