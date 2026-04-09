// =============================================================================
// GET /api/activities/suggestions?q=texto
//
// Devuelve hasta 5 sugerencias mixtas: actividades, categorías, ciudades.
// Ranking por tipo: coincidencia exacta (prefix) > popularidad > parcial.
// Orden de mezcla: actividades primero, luego categorías, luego ciudades.
// Mínimo 3 caracteres.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export type SuggestionType = 'activity' | 'category' | 'city';

export interface SuggestionItem {
  type: SuggestionType;
  id: string;
  label: string;       // Texto principal a mostrar y resaltar
  sublabel: string | null; // Texto secundario (categoría, conteo, etc.)
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (q.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const qLower = q.toLowerCase();
  const isPrefix = (text: string) => text.toLowerCase().startsWith(qLower);
  // Score 2 = empieza por q (mejor match), 1 = contiene q
  const rankScore = (text: string) => (isPrefix(text) ? 2 : 1);

  try {
    const [activities, categories, cities] = await Promise.all([

      // Actividades: coincidencia en título (mayor confianza primero)
      prisma.activity.findMany({
        where: {
          status: 'ACTIVE',
          title: { contains: q, mode: 'insensitive' },
        },
        select: {
          id: true,
          title: true,
          sourceConfidence: true,
          categories: {
            select: { category: { select: { name: true } } },
            take: 1,
          },
        },
        take: 10, // Tomamos más para rankear localmente
      }),

      // Categorías: con al menos 1 actividad activa que coincida
      prisma.category.findMany({
        where: {
          name: { contains: q, mode: 'insensitive' },
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
        take: 5,
      }),

      // Ciudades: con al menos 1 actividad activa
      prisma.city.findMany({
        where: {
          name: { contains: q, mode: 'insensitive' },
          locations: {
            some: { activities: { some: { status: 'ACTIVE' } } },
          },
        },
        select: { id: true, name: true },
        take: 3,
      }),
    ]);

    // Rank actividades: prefix primero, luego sourceConfidence → max 3
    const rankedActivities: SuggestionItem[] = activities
      .sort((a, b) => {
        const sd = rankScore(b.title) - rankScore(a.title);
        if (sd !== 0) return sd;
        return (b.sourceConfidence ?? 0) - (a.sourceConfidence ?? 0);
      })
      .slice(0, 3)
      .map(a => ({
        type: 'activity',
        id: a.id,
        label: a.title,
        sublabel: a.categories[0]?.category.name ?? null,
      }));

    // Rank categorías: prefix primero, luego conteo → max 1
    const rankedCategories: SuggestionItem[] = categories
      .sort((a, b) => {
        const sd = rankScore(b.name) - rankScore(a.name);
        if (sd !== 0) return sd;
        return b._count.activities - a._count.activities;
      })
      .slice(0, 1)
      .map(c => ({
        type: 'category',
        id: c.id,
        label: c.name,
        sublabel: `${c._count.activities} actividad${c._count.activities !== 1 ? 'es' : ''}`,
      }));

    // Rank ciudades: prefix primero → max 1
    const rankedCities: SuggestionItem[] = cities
      .sort((a, b) => rankScore(b.name) - rankScore(a.name))
      .slice(0, 1)
      .map(c => ({
        type: 'city',
        id: c.id,
        label: c.name,
        sublabel: null,
      }));

    // Mezcla final: actividades → categorías → ciudades, máximo 5
    const suggestions = [
      ...rankedActivities,
      ...rankedCategories,
      ...rankedCities,
    ].slice(0, 5);

    return NextResponse.json({ suggestions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
