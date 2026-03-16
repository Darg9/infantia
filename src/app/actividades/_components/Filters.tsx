'use client';

// =============================================================================
// Filters — barra de filtros client-side para /actividades
// Actualiza los query params de la URL sin recargar la página
// =============================================================================

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Category {
  id: string;
  name: string;
}

interface FiltersProps {
  search: string;
  ageMin: string;
  ageMax: string;
  categoryId: string;
  categories: Category[];
  total: number;
}

const AGE_OPTIONS = [
  { label: 'Cualquier edad', min: '', max: '' },
  { label: '0–3 años', min: '0', max: '3' },
  { label: '4–6 años', min: '4', max: '6' },
  { label: '7–10 años', min: '7', max: '10' },
  { label: '11–14 años', min: '11', max: '14' },
  { label: '15–18 años', min: '15', max: '18' },
];

export default function Filters({ search, ageMin, ageMax, categoryId, categories, total }: FiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchValue, setSearchValue] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincroniza si cambia desde fuera (navegación back/forward)
  useEffect(() => { setSearchValue(search); }, [search]);

  const navigate = useCallback((params: Record<string, string>) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
    sp.delete('page'); // reset paginación al cambiar filtros
    router.push(`${pathname}?${sp.toString()}`);
  }, [router, pathname]);

  // Estado derivado de ageMin+ageMax para el select
  const currentAgeValue = AGE_OPTIONS.findIndex(o => o.min === ageMin && o.max === ageMax);
  const ageIndex = currentAgeValue === -1 ? 0 : currentAgeValue;

  function handleSearchChange(value: string) {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate({ search: value, ageMin, ageMax, categoryId });
    }, 400);
  }

  function handleAgeChange(index: number) {
    const option = AGE_OPTIONS[index];
    navigate({ search: searchValue, ageMin: option.min, ageMax: option.max, categoryId });
  }

  function handleCategoryChange(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId: value });
  }

  function handleReset() {
    setSearchValue('');
    navigate({});
  }

  const hasFilters = search || ageMin || ageMax || categoryId;

  return (
    <div className="flex flex-col gap-3">
      {/* Fila de filtros */}
      <div className="flex flex-col sm:flex-row gap-2">

        {/* Búsqueda por texto */}
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

        {/* Filtro por edad */}
        <select
          value={ageIndex}
          onChange={e => handleAgeChange(Number(e.target.value))}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-44"
        >
          {AGE_OPTIONS.map((o, i) => (
            <option key={i} value={i}>{o.label}</option>
          ))}
        </select>

        {/* Filtro por categoría */}
        <select
          value={categoryId}
          onChange={e => handleCategoryChange(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-52"
        >
          <option value="">Todas las categorías</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Botón limpiar */}
        {hasFilters && (
          <button
            onClick={handleReset}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors whitespace-nowrap"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Resultado count */}
      <p className="text-sm text-gray-500">
        {total === 0
          ? 'No se encontraron actividades'
          : `${total} actividad${total !== 1 ? 'es' : ''} encontrada${total !== 1 ? 's' : ''}`
        }
        {hasFilters && <span className="text-indigo-600"> (con filtros activos)</span>}
      </p>
    </div>
  );
}
