'use client';

// =============================================================================
// Filters — barra de filtros facetados para /actividades
// Cada filtro sólo muestra opciones que producen al menos 1 resultado
// dado los demás filtros activos (filtrado facetado completo)
// =============================================================================

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Category {
  id: string;
  name: string;
  _count: { activities: number };
}

interface Facets {
  availableTypes: { type: string; count: number }[];
  audienceCounts: { KIDS: number; FAMILY: number; ADULTS: number };
  validCategories: Category[];
}

interface FiltersProps {
  search: string;
  ageMin: string;
  ageMax: string;
  categoryId: string;
  type: string;
  audience: string;
  facets: Facets;
  total: number;
}

const AGE_OPTIONS = [
  { label: 'Cualquier edad', min: '', max: '' },
  { label: '0–3 años',       min: '0',  max: '3'  },
  { label: '4–6 años',       min: '4',  max: '6'  },
  { label: '7–10 años',      min: '7',  max: '10' },
  { label: '11–14 años',     min: '11', max: '14' },
  { label: '15–18 años',     min: '15', max: '18' },
];

const ALL_TYPES = [
  { value: 'ONE_TIME',   label: 'Única vez'   },
  { value: 'RECURRING',  label: 'Recurrente'  },
  { value: 'WORKSHOP',   label: 'Taller'      },
  { value: 'CAMP',       label: 'Campamento'  },
];

const ALL_AUDIENCES = [
  { value: 'KIDS',   label: '👧 Niños'   },
  { value: 'FAMILY', label: '👨‍👩‍👧 Familia' },
  { value: 'ADULTS', label: '🧑 Adultos'  },
];

export default function Filters({
  search, ageMin, ageMax, categoryId, type, audience, facets, total,
}: FiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchValue, setSearchValue] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setSearchValue(search); }, [search]);

  const navigate = useCallback((params: Record<string, string>) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
    sp.delete('page');
    router.push(`${pathname}?${sp.toString()}`);
  }, [router, pathname]);

  const currentAgeIndex = AGE_OPTIONS.findIndex(o => o.min === ageMin && o.max === ageMax);
  const ageIndex = currentAgeIndex === -1 ? 0 : currentAgeIndex;

  function handleSearchChange(value: string) {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate({ search: value, ageMin, ageMax, categoryId, type, audience });
    }, 400);
  }

  function handleAgeChange(index: number) {
    const option = AGE_OPTIONS[index];
    navigate({ search: searchValue, ageMin: option.min, ageMax: option.max, categoryId, type, audience });
  }

  function handleCategoryChange(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId: value, type, audience });
  }

  function handleTypeChange(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId, type: value, audience });
  }

  function handleAudienceChange(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId, type, audience: value });
  }

  function handleReset() {
    setSearchValue('');
    navigate({});
  }

  const hasFilters = search || ageMin || ageMax || categoryId || type || audience;

  function selectCls(active: boolean, width = '') {
    const base = 'rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-colors cursor-pointer';
    const off = 'border-gray-200 bg-white text-gray-700 focus:border-indigo-400 focus:ring-indigo-100';
    const on  = 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium focus:ring-indigo-100';
    return `${base} ${active ? on : off} ${width}`;
  }

  // Filtros facetados: sólo mostrar opciones disponibles
  const visibleTypes = ALL_TYPES.filter(t =>
    // Siempre mostrar la opción actualmente seleccionada aunque no tenga resultados
    t.value === type || facets.availableTypes.some(a => a.type === t.value && a.count > 0)
  );

  const visibleAudiences = ALL_AUDIENCES.filter(a =>
    a.value === audience || facets.audienceCounts[a.value as keyof typeof facets.audienceCounts] > 0
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Fila 1: búsqueda + edad + audiencia */}
      <div className="flex flex-col sm:flex-row gap-2">

        {/* Búsqueda */}
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={searchValue}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Buscar actividades..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {/* Edad */}
        <select
          value={ageIndex}
          onChange={e => handleAgeChange(Number(e.target.value))}
          className={selectCls(ageIndex !== 0, 'sm:w-40')}
        >
          {AGE_OPTIONS.map((o, i) => (
            <option key={i} value={i}>{o.label}</option>
          ))}
        </select>

        {/* Audiencia — facetado */}
        <select
          value={audience}
          onChange={e => handleAudienceChange(e.target.value)}
          className={selectCls(audience !== '', 'sm:w-40')}
        >
          <option value="">👤 Todos</option>
          {visibleAudiences.map(a => (
            <option key={a.value} value={a.value}>
              {a.label} ({facets.audienceCounts[a.value as keyof typeof facets.audienceCounts]})
            </option>
          ))}
        </select>
      </div>

      {/* Fila 2: tipo + categoría + limpiar */}
      <div className="flex flex-col sm:flex-row gap-2">

        {/* Tipo — facetado */}
        <select
          value={type}
          onChange={e => handleTypeChange(e.target.value)}
          className={selectCls(type !== '', 'sm:w-44')}
        >
          <option value="">Todos los tipos</option>
          {visibleTypes.map(t => {
            const count = facets.availableTypes.find(a => a.type === t.value)?.count ?? 0;
            return (
              <option key={t.value} value={t.value}>{t.label} ({count})</option>
            );
          })}
        </select>

        {/* Categoría — facetado */}
        <select
          value={categoryId}
          onChange={e => handleCategoryChange(e.target.value)}
          className={selectCls(categoryId !== '', 'sm:w-56')}
        >
          <option value="">Todas las categorías</option>
          {facets.validCategories.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c._count.activities})</option>
          ))}
        </select>

        {/* Limpiar */}
        {hasFilters && (
          <button
            onClick={handleReset}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors whitespace-nowrap"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Contador */}
      <p className="text-sm text-gray-500">
        {total === 0
          ? 'No se encontraron actividades'
          : `${total} actividad${total !== 1 ? 'es' : ''} encontrada${total !== 1 ? 's' : ''}`
        }
      </p>
    </div>
  );
}
