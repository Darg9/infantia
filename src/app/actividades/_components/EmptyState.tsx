// =============================================================================
// EmptyState — Estado vacío context-aware para /actividades
// Muestra sugerencias específicas según qué filtros están activos
// =============================================================================

import { getCategoryEmoji } from '@/lib/category-utils';

interface PopularCategory {
  id: string;
  name: string;
}

interface EmptyStateProps {
  search?: string;
  ageMin?: number;
  ageMax?: number;
  categoryId?: string;
  categoryName?: string;
  type?: string;
  audience?: string;
  popularCategories: PopularCategory[];
}

const TYPE_LABELS: Record<string, string> = {
  RECURRING: 'recurrentes',
  ONE_TIME: 'de única vez',
  CAMP: 'campamentos',
  WORKSHOP: 'talleres',
};

const AUDIENCE_LABELS: Record<string, string> = {
  KIDS: 'niños',
  FAMILY: 'familia',
  ADULTS: 'adultos',
};

export function EmptyState({
  search,
  ageMin,
  ageMax,
  categoryId,
  categoryName,
  type,
  audience,
  popularCategories,
}: EmptyStateProps) {
  const hasFilters = search || ageMin != null || ageMax != null || categoryId || type || audience;

  // Construir titular contextual
  let headline = 'Sin resultados para esa combinación de filtros';
  if (search) {
    headline = `No encontramos resultados para "${search}"`;
  } else if (categoryId && categoryName) {
    headline = `No hay actividades en "${categoryName}" con esos filtros`;
  }

  // Sugerencias específicas según filtros activos
  const tips: string[] = [];
  if (search) {
    tips.push('Revisa que no haya errores tipográficos');
    tips.push('Prueba con términos más generales, como "arte" o "música"');
  }
  if (ageMin != null || ageMax != null) {
    const rangeText = ageMin != null && ageMax != null
      ? `${ageMin}–${ageMax} años`
      : ageMin != null
      ? `desde ${ageMin} años`
      : `hasta ${ageMax} años`;
    tips.push(`Amplía el rango de edad (ahora filtrado por ${rangeText})`);
  }
  if (type) {
    tips.push(`Prueba sin filtrar por tipo "${TYPE_LABELS[type] ?? type}"`);
  }
  if (audience) {
    tips.push(`Prueba sin filtrar por audiencia "${AUDIENCE_LABELS[audience] ?? audience}"`);
  }
  if (tips.length === 0) {
    tips.push('Intenta con otros filtros o explora por categoría');
  }

  return (
    <div className="flex flex-col items-center py-20 gap-6 text-center">
      {/* Ilustración */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-6xl select-none">🔍</span>
        <h2 className="text-xl font-semibold text-gray-800 max-w-sm">{headline}</h2>
        <p className="text-sm text-gray-400 max-w-xs">
          {tips[0]}
        </p>
      </div>

      {/* Lista de sugerencias (cuando hay más de una) */}
      {tips.length > 1 && (
        <ul className="text-sm text-gray-500 flex flex-col gap-1.5 text-left max-w-xs">
          {tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-indigo-400 mt-0.5">→</span>
              {tip}
            </li>
          ))}
        </ul>
      )}

      {/* CTA principal */}
      {hasFilters && (
        <a
          href="/actividades"
          className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          Limpiar filtros y ver todo
        </a>
      )}

      {/* Categorías populares como sugerencias rápidas */}
      {popularCategories.length > 0 && (
        <div className="flex flex-col items-center gap-3 mt-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            O explora estas categorías
          </p>
          <div className="flex flex-wrap justify-center gap-2 max-w-sm">
            {popularCategories.slice(0, 6).map((cat) => (
              <a
                key={cat.id}
                href={`/actividades?categoryId=${cat.id}`}
                className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
              >
                <span>{getCategoryEmoji(cat.name)}</span>
                {cat.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
