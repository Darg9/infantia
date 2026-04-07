'use client';

// =============================================================================
// Filters — barra de filtros facetados para /actividades
// Cada filtro sólo muestra opciones que producen al menos 1 resultado
// dado los demás filtros activos (filtrado facetado completo)
// =============================================================================

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { activityPath } from '@/lib/activity-url';

interface Suggestion {
  id: string;
  title: string;
  category: string | null;
}

interface Category {
  id: string;
  name: string;
  _count: { activities: number };
}

interface City {
  id: string;
  name: string;
}

interface Facets {
  availableTypes: { type: string; count: number }[];
  audienceCounts: { KIDS: number; FAMILY: number; ADULTS: number };
  validCategories: Category[];
  priceCounts: { free: number; paid: number };
  availableCities: City[];
}

const SORT_OPTIONS = [
  { value: 'relevance',  label: '⭐ Relevancia'       },
  { value: 'date',       label: '📅 Próximas primero'  },
  { value: 'newest',     label: '🆕 Recién agregadas'  },
  { value: 'price_asc',  label: '💰 Precio: menor'    },
  { value: 'price_desc', label: '💰 Precio: mayor'    },
] as const;

interface FiltersProps {
  search: string;
  ageMin: string;
  ageMax: string;
  categoryId: string;
  cityId: string;
  type: string;
  audience: string;
  price: string;
  sort: string;
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

// Resalta la parte del título que coincide con el query
function highlightMatch(title: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return title;
  const idx = title.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return title;
  return (
    <>
      {title.slice(0, idx)}
      <mark className="bg-indigo-100 text-indigo-800 rounded px-0.5">{title.slice(idx, idx + query.length)}</mark>
      {title.slice(idx + query.length)}
    </>
  );
}

export default function Filters({
  search, ageMin, ageMax, categoryId, cityId, type, audience, price, sort, facets, total,
}: FiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchValue, setSearchValue] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Estado de sugerencias
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearchValue(search); }, [search]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch sugerencias con debounce independiente (más corto: 200ms)
  function fetchSuggestions(value: string) {
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    if (value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    suggestDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/activities/suggestions?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setShowSuggestions((data.suggestions ?? []).length > 0);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
      }
    }, 200);
  }

  // Navegar a la actividad sugerida directamente
  function selectSuggestion(suggestion: Suggestion) {
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveIndex(-1);
    router.push(activityPath(suggestion.id, suggestion.title));
  }

  // Usar texto de sugerencia como término de búsqueda
  function applySuggestionAsSearch(title: string) {
    setSearchValue(title);
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveIndex(-1);
    navigate({ search: title, ageMin, ageMax, categoryId, cityId, type, audience, price, sort });
  }

  // Navegar con teclado en el dropdown
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  }

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
    fetchSuggestions(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate({ search: value, ageMin, ageMax, categoryId, cityId, type, audience, price, sort });
      // Registra la búsqueda (fire-and-forget, solo si tiene contenido)
      if (value.trim().length >= 3) {
        fetch('/api/search/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: value.trim(), resultCount: total }),
        }).catch(() => {});
      }
    }, 400);
  }

  function handleAgeChange(index: number) {
    const option = AGE_OPTIONS[index];
    navigate({ search: searchValue, ageMin: option.min, ageMax: option.max, categoryId, cityId, type, audience, price, sort });
  }

  function handleCategoryChange(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId: value, cityId, type, audience, price, sort });
  }

  function handleCityChange(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId: value, type, audience, price, sort });
  }

  function handleTypeChange(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId, type: value, audience, price, sort });
  }

  function handleAudienceChange(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId, type, audience: value, price, sort });
  }

  function handlePriceChange(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId, type, audience, price: value, sort });
  }

  function handleSortChange(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId, type, audience, price, sort: value });
  }

  function handleReset() {
    setSearchValue('');
    navigate({});
  }

  const hasFilters = search || ageMin || ageMax || categoryId || cityId || type || audience || price || (sort && sort !== 'relevance');

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

        {/* Búsqueda con autocompletado */}
        <div className="relative flex-1" ref={searchContainerRef}>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
          <input
            type="text"
            value={searchValue}
            onChange={e => handleSearchChange(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar actividades..."
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />

          {/* Dropdown de sugerencias */}
          {showSuggestions && suggestions.length > 0 && (
            <ul
              role="listbox"
              className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
            >
              {suggestions.map((s, i) => (
                <li
                  key={s.id}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex(-1)}
                  className={`flex items-center justify-between gap-2 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                    i === activeIndex ? 'bg-indigo-50 text-indigo-900' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {/* Click en el texto → busca ese término */}
                  <span
                    className="flex-1 truncate"
                    onClick={() => applySuggestionAsSearch(s.title)}
                  >
                    <span className="font-medium">{highlightMatch(s.title, searchValue)}</span>
                    {s.category && (
                      <span className="ml-2 text-xs text-gray-400">{s.category}</span>
                    )}
                  </span>
                  {/* Flecha → va directamente a la actividad */}
                  <button
                    onClick={() => selectSuggestion(s)}
                    title="Ver actividad"
                    className="shrink-0 text-gray-300 hover:text-indigo-500 transition-colors text-xs px-1"
                    tabIndex={-1}
                  >
                    →
                  </button>
                </li>
              ))}
              <li className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
                ↑↓ navegar · Enter ir a actividad · Esc cerrar
              </li>
            </ul>
          )}
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

      {/* Fila 2: tipo + categoría + precio + limpiar */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">

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

        {/* Precio */}
        <select
          value={price}
          onChange={e => handlePriceChange(e.target.value)}
          className={selectCls(price !== '', 'sm:w-44')}
        >
          <option value="">💰 Todos los precios</option>
          <option value="free">🟢 Gratis ({facets.priceCounts.free})</option>
          <option value="paid">💳 De pago ({facets.priceCounts.paid})</option>
        </select>

        {/* Ciudad — solo si hay más de 1 opción */}
        {facets.availableCities.length > 1 && (
          <select
            value={cityId}
            onChange={e => handleCityChange(e.target.value)}
            className={selectCls(cityId !== '', 'sm:w-44')}
          >
            <option value="">🏙 Todas las ciudades</option>
            {facets.availableCities.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        {/* Ordenar */}
        <select
          value={sort}
          onChange={e => handleSortChange(e.target.value)}
          className={selectCls(sort !== 'relevance', 'sm:w-48 ml-auto')}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
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
