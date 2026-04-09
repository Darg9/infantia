'use client';

// =============================================================================
// Filters — barra de filtros facetados para /actividades
// Desktop: Search → Categoría | Precio (pills) | Ubicación | Edad | Ordenar | Limpiar filtros
//          → Chips activos con ✕ individual
// Mobile:  Search | botón "Filtros" → modal full-screen con footer Limpiar/Aplicar
//          → Chips visibles fuera del modal
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
  { value: 'relevance',  label: 'Relevancia'       },
  { value: 'date',       label: 'Próximas primero'  },
  { value: 'newest',     label: 'Recién agregadas'  },
  { value: 'price_asc',  label: 'Precio: menor'     },
  { value: 'price_desc', label: 'Precio: mayor'     },
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

// Resalta la parte del título que coincide con el query
function highlightMatch(title: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return title;
  const idx = title.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return title;
  return (
    <>
      {title.slice(0, idx)}
      <mark className="bg-indigo-100 text-indigo-800 rounded px-0.5">
        {title.slice(idx, idx + query.length)}
      </mark>
      {title.slice(idx + query.length)}
    </>
  );
}

export default function Filters({
  search, ageMin, ageMax, categoryId, cityId, type, audience, price, sort, facets, total,
}: FiltersProps) {
  const router   = useRouter();
  const pathname = usePathname();

  // ── Búsqueda ────────────────────────────────────────────────────────────
  const [searchValue, setSearchValue]   = useState(search);
  const debounceRef                     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestDebounceRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suggestions, setSuggestions]   = useState<Suggestion[]>([]);
  const [showSugg, setShowSugg]         = useState(false);
  const [activeIndex, setActiveIndex]   = useState(-1);
  const searchContainerRef              = useRef<HTMLDivElement>(null);

  // ── Modal mobile ─────────────────────────────────────────────────────────
  const [mobileOpen, setMobileOpen]         = useState(false);
  const [mobileAgeIdx, setMobileAgeIdx]     = useState(0);
  const [mobileCatId, setMobileCatId]       = useState('');
  const [mobileCityId, setMobileCityId]     = useState('');
  const [mobilePrice, setMobilePrice]       = useState('');
  const [mobileSort, setMobileSort]         = useState('relevance');

  useEffect(() => { setSearchValue(search); }, [search]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSugg(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Bloquear scroll cuando el modal mobile está abierto
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // ── Navegación ───────────────────────────────────────────────────────────
  const navigate = useCallback((params: Record<string, string>) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
    sp.delete('page');
    router.push(`${pathname}?${sp.toString()}`);
  }, [router, pathname]);

  // ── Autocompletado ──────────────────────────────────────────────────────
  function fetchSuggestions(value: string) {
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    if (value.length < 3) { setSuggestions([]); setShowSugg(false); return; }
    suggestDebounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/activities/suggestions?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setShowSugg((data.suggestions ?? []).length > 0);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
      }
    }, 200);
  }

  function selectSuggestion(s: Suggestion) {
    setShowSugg(false); setSuggestions([]); setActiveIndex(-1);
    router.push(activityPath(s.id, s.title));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSugg || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) {
        selectSuggestion(suggestions[activeIndex]);
      } else {
        handleSearchSubmit();
      }
    } else if (e.key === 'Escape') {
      setShowSugg(false); setActiveIndex(-1);
    }
  }

  function handleSearchChange(value: string) {
    setSearchValue(value);
    fetchSuggestions(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate({ search: value, ageMin, ageMax, categoryId, cityId, type, audience, price, sort });
      if (value.trim().length >= 3) {
        fetch('/api/search/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: value.trim(), resultCount: total }),
        }).catch(() => {});
      }
    }, 400);
  }

  function handleSearchSubmit() {
    setShowSugg(false);
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId, type, audience, price, sort });
  }

  // ── Handlers desktop ────────────────────────────────────────────────────
  const currentAgeIndex = AGE_OPTIONS.findIndex(o => o.min === ageMin && o.max === ageMax);
  const ageIndex = currentAgeIndex === -1 ? 0 : currentAgeIndex;

  function handleAgeChange(index: number) {
    const o = AGE_OPTIONS[index];
    navigate({ search: searchValue, ageMin: o.min, ageMax: o.max, categoryId, cityId, type, audience, price, sort });
  }

  function handleCategoryChange(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId: value, cityId, type, audience, price, sort });
  }

  function handleCityChange(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId: value, type, audience, price, sort });
  }

  function handlePriceToggle(value: 'free' | 'paid') {
    const newPrice = price === value ? '' : value;
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId, type, audience, price: newPrice, sort });
  }

  function handleSortChange(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId, type, audience, price, sort: value });
  }

  function handleReset() {
    setSearchValue('');
    navigate({});
  }

  // ── Modal mobile ─────────────────────────────────────────────────────────
  function openMobile() {
    setMobileAgeIdx(ageIndex);
    setMobileCatId(categoryId);
    setMobileCityId(cityId);
    setMobilePrice(price);
    setMobileSort(sort);
    setMobileOpen(true);
  }

  function clearMobile() {
    setMobileAgeIdx(0);
    setMobileCatId('');
    setMobileCityId('');
    setMobilePrice('');
    setMobileSort('relevance');
  }

  function applyMobile() {
    const o = AGE_OPTIONS[mobileAgeIdx];
    navigate({
      search: searchValue,
      ageMin: o.min, ageMax: o.max,
      categoryId: mobileCatId,
      cityId: mobileCityId,
      type, audience, // preservar desde URL
      price: mobilePrice,
      sort: mobileSort,
    });
    setMobileOpen(false);
  }

  // ── Chips activos ────────────────────────────────────────────────────────
  const categoryName = facets.validCategories.find(c => c.id === categoryId)?.name;
  const cityName     = facets.availableCities.find(c => c.id === cityId)?.name;
  const ageName      = ageIndex !== 0 ? AGE_OPTIONS[ageIndex]?.label : null;
  const priceName    = price === 'free' ? 'Gratis' : price === 'paid' ? 'De pago' : null;

  // Orden fijo: Ubicación → Categoría → Precio → Edad
  type Chip = { key: string; label: string; onRemove: () => void };
  const chips: Chip[] = [
    cityName     && { key: 'city',     label: cityName,     onRemove: () => handleCityChange('') },
    categoryName && { key: 'category', label: categoryName, onRemove: () => handleCategoryChange('') },
    priceName    && { key: 'price',    label: priceName,    onRemove: () => handlePriceToggle(price as 'free' | 'paid') },
    ageName      && { key: 'age',      label: ageName,      onRemove: () => handleAgeChange(0) },
  ].filter(Boolean) as Chip[];

  const hasFilters = !!(search || ageMin || ageMax || categoryId || cityId || price || (sort && sort !== 'relevance'));
  const mobileHasChanges = !!(mobileCatId || mobileCityId || mobilePrice || mobileAgeIdx !== 0 || mobileSort !== 'relevance');

  // ── Estilos ──────────────────────────────────────────────────────────────
  function selectCls(active: boolean) {
    const base = 'rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors cursor-pointer';
    const off  = 'border-gray-200 bg-white text-gray-600 focus:border-indigo-400 focus:ring-indigo-100';
    const on   = 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium focus:ring-indigo-100';
    return `${base} ${active ? on : off}`;
  }

  function pillCls(active: boolean) {
    return `px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer whitespace-nowrap ${
      active
        ? 'bg-indigo-600 text-white border-indigo-600'
        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
    }`;
  }

  // ── Componente búsqueda (reutilizado en desktop y mobile) ─────────────────
  const SearchBox = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={`relative ${isMobile ? 'w-full' : 'flex-1 min-w-0'}`} ref={isMobile ? undefined : searchContainerRef}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none select-none">🔍</span>
      <input
        type="text"
        value={searchValue}
        onChange={e => handleSearchChange(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setShowSugg(true); }}
        onKeyDown={handleKeyDown}
        placeholder="Buscar actividades..."
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showSugg}
        className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />

      {/* Dropdown de sugerencias */}
      {!isMobile && showSugg && suggestions.length > 0 && (
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
              onClick={() => selectSuggestion(s)}
              className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                i === activeIndex ? 'bg-indigo-50 text-indigo-900' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex-1 truncate font-medium">{highlightMatch(s.title, searchValue)}</span>
              {s.category && (
                <span className="text-xs text-gray-400 shrink-0">{s.category}</span>
              )}
              <span className="text-gray-300 text-xs shrink-0">→</span>
            </li>
          ))}
          <li className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 select-none">
            ↑↓ navegar · Enter seleccionar · Esc cerrar
          </li>
        </ul>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* DESKTOP                                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="hidden sm:flex items-center gap-2 flex-wrap" ref={searchContainerRef}>

        {/* Búsqueda */}
        <SearchBox />

        {/* Categoría */}
        <select
          value={categoryId}
          onChange={e => handleCategoryChange(e.target.value)}
          className={selectCls(!!categoryId)}
          aria-label="Categoría"
        >
          <option value="">Categoría</option>
          {facets.validCategories.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c._count.activities})</option>
          ))}
        </select>

        {/* Precio — pills independientes */}
        <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1" role="group" aria-label="Precio">
          <button
            type="button"
            onClick={() => handlePriceToggle('free')}
            className={pillCls(price === 'free')}
          >
            Gratis {facets.priceCounts.free > 0 && price !== 'free' && (
              <span className="ml-1 text-xs opacity-60">({facets.priceCounts.free})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handlePriceToggle('paid')}
            className={pillCls(price === 'paid')}
          >
            De pago {facets.priceCounts.paid > 0 && price !== 'paid' && (
              <span className="ml-1 text-xs opacity-60">({facets.priceCounts.paid})</span>
            )}
          </button>
        </div>

        {/* Ubicación — solo si hay más de 1 ciudad */}
        {facets.availableCities.length > 1 && (
          <select
            value={cityId}
            onChange={e => handleCityChange(e.target.value)}
            className={selectCls(!!cityId)}
            aria-label="Ubicación"
          >
            <option value="">Ubicación</option>
            {facets.availableCities.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        {/* Edad */}
        <select
          value={ageIndex}
          onChange={e => handleAgeChange(Number(e.target.value))}
          className={selectCls(ageIndex !== 0)}
          aria-label="Edad"
        >
          <option value={0}>Edad</option>
          {AGE_OPTIONS.slice(1).map((o, i) => (
            <option key={i + 1} value={i + 1}>{o.label}</option>
          ))}
        </select>

        {/* Ordenar */}
        <select
          value={sort}
          onChange={e => handleSortChange(e.target.value)}
          className={selectCls(sort !== 'relevance')}
          aria-label="Ordenar"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Limpiar filtros — solo cuando hay filtros activos */}
        {hasFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-800 underline underline-offset-2 whitespace-nowrap transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MOBILE — fila: búsqueda + botón filtros                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex sm:hidden gap-2">
        {/* Búsqueda */}
        <div className="relative flex-1" ref={searchContainerRef}>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none select-none">🔍</span>
          <input
            type="text"
            value={searchValue}
            onChange={e => handleSearchChange(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSugg(true); }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar actividades..."
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={showSugg}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          {/* Dropdown sugerencias mobile */}
          {showSugg && suggestions.length > 0 && (
            <ul
              role="listbox"
              className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
            >
              {suggestions.map((s, i) => (
                <li
                  key={s.id}
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => selectSuggestion(s)}
                  className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer text-sm ${
                    i === activeIndex ? 'bg-indigo-50 text-indigo-900' : 'text-gray-700'
                  }`}
                >
                  <span className="flex-1 truncate font-medium">{highlightMatch(s.title, searchValue)}</span>
                  <span className="text-gray-300 text-xs">→</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Botón filtros */}
        <button
          type="button"
          onClick={openMobile}
          className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            hasFilters
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 12h12M10 20h4" />
          </svg>
          Filtros
          {hasFilters && (
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white text-xs font-bold leading-none">
              {chips.length}
            </span>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CHIPS activos — visibles en desktop y mobile (fuera del modal)     */}
      {/* Orden: Ubicación → Categoría → Precio → Edad                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {chips.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          {chips.map(chip => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-sm font-medium text-indigo-700"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`Quitar filtro ${chip.label}`}
                className="text-indigo-400 hover:text-indigo-700 transition-colors leading-none"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CONTADOR de resultados                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <p className="text-sm text-gray-500">
        {total === 0 ? (
          <>
            No hay actividades con estos filtros.{' '}
            {hasFilters && (
              <button
                type="button"
                onClick={handleReset}
                className="text-indigo-600 hover:underline font-medium"
              >
                Limpiar filtros
              </button>
            )}
          </>
        ) : (
          `${total.toLocaleString('es-CO')} actividad${total !== 1 ? 'es' : ''} encontrada${total !== 1 ? 's' : ''}`
        )}
      </p>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL MOBILE — full screen con temp state                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white sm:hidden" role="dialog" aria-modal="true" aria-label="Filtros">

          {/* Header modal */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">Filtros</h2>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar filtros"
              className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {/* Contenido desplazable */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">

            {/* Categoría */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Categoría</label>
              <select
                value={mobileCatId}
                onChange={e => setMobileCatId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Todas las categorías</option>
                {facets.validCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c._count.activities})</option>
                ))}
              </select>
            </div>

            {/* Precio */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Precio</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMobilePrice(p => p === 'free' ? '' : 'free')}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    mobilePrice === 'free'
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300'
                  }`}
                >
                  Gratis
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePrice(p => p === 'paid' ? '' : 'paid')}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    mobilePrice === 'paid'
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300'
                  }`}
                >
                  De pago
                </button>
              </div>
            </div>

            {/* Ubicación — solo si hay más de 1 ciudad */}
            {facets.availableCities.length > 1 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ubicación</label>
                <select
                  value={mobileCityId}
                  onChange={e => setMobileCityId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Todas las ciudades</option>
                  {facets.availableCities.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Edad */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Edad</label>
              <div className="grid grid-cols-2 gap-2">
                {AGE_OPTIONS.map((o, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setMobileAgeIdx(i)}
                    className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                      mobileAgeIdx === i
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ordenar */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Ordenar por</label>
              <select
                value={mobileSort}
                onChange={e => setMobileSort(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer fijo */}
          <div className="border-t border-gray-100 px-4 py-4 flex gap-3">
            <button
              type="button"
              onClick={clearMobile}
              disabled={!mobileHasChanges}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={applyMobile}
              className="flex-2 flex-[2] rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
