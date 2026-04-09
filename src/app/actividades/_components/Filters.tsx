'use client';

// =============================================================================
// Filters — cabecera de resultados de /actividades
//
// Desktop: [Buscador prominente (full-width)]
//          [Categoría▼] [Gratis|De pago] [Edad▼] [Ordenar▼] [Limpiar filtros]
//          [Chips activos: ciudad ✕  categoría ✕  precio ✕  edad ✕]
//          [N actividades encontradas]
//
// Mobile:  [Buscador] [Filtros▼ (badge N)]
//          [Chips activos]
//          [N actividades]
//          → Modal full-screen: categoría | precio | edad | ordenar
//            Footer fijo: Limpiar · Aplicar filtros
//
// Estados: loading (spinner en buscador + opacidad) | vacío | error suggestions
// =============================================================================

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { activityPath } from '@/lib/activity-url';

// ── Interfaces ────────────────────────────────────────────────────────────────

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

// ── Constantes ────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'relevance',  label: 'Relevancia'      },
  { value: 'date',       label: 'Próximas primero' },
  { value: 'newest',     label: 'Recién agregadas' },
  { value: 'price_asc',  label: 'Precio: menor'    },
  { value: 'price_desc', label: 'Precio: mayor'    },
] as const;

const AGE_OPTIONS = [
  { label: 'Cualquier edad', min: '', max: '' },
  { label: '0–3 años',       min: '0',  max: '3'  },
  { label: '4–6 años',       min: '4',  max: '6'  },
  { label: '7–10 años',      min: '7',  max: '10' },
  { label: '11–14 años',     min: '11', max: '14' },
  { label: '15–18 años',     min: '15', max: '18' },
];

// ── Skeleton (exportado para Suspense fallback) ───────────────────────────────

export function FiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {/* Buscador */}
      <div className="h-14 rounded-2xl bg-gray-100 w-full" />
      {/* Fila de filtros */}
      <div className="hidden sm:flex gap-2">
        <div className="h-9 rounded-xl bg-gray-100 w-36" />
        <div className="h-9 rounded-xl bg-gray-100 w-40" />
        <div className="h-9 rounded-xl bg-gray-100 w-28" />
        <div className="h-9 rounded-xl bg-gray-100 w-32" />
      </div>
      {/* Contador */}
      <div className="h-4 rounded bg-gray-100 w-44" />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-4 w-4 text-indigo-400 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Filters({
  search, ageMin, ageMax, categoryId, cityId, type, audience, price, sort, facets, total,
}: FiltersProps) {
  const router   = useRouter();
  const pathname = usePathname();

  // Búsqueda + sugerencias
  const [searchValue, setSearchValue]   = useState(search);
  const [suggestions, setSuggestions]   = useState<Suggestion[]>([]);
  const [showSugg, setShowSugg]         = useState(false);
  const [activeIndex, setActiveIndex]   = useState(-1);
  const [suggError, setSuggError]       = useState(false);
  const debounceRef                     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestDebRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchControllerRef              = useRef<AbortController | null>(null);
  const searchContainerRef              = useRef<HTMLDivElement>(null);

  // Estado de carga: true desde que se llama navigate() hasta que los props cambian
  const [isPending, setIsPending] = useState(false);

  // Modal mobile + temp state
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [mobileAgeIdx, setMobileAgeIdx] = useState(0);
  const [mobileCatId, setMobileCatId]   = useState('');
  const [mobileCityId, setMobileCityId] = useState('');
  const [mobilePrice, setMobilePrice]   = useState('');
  const [mobileSort, setMobileSort]     = useState('relevance');

  // ── Efectos ────────────────────────────────────────────────────────────────

  // Cuando el Server Component devuelve nuevos props → navagación completada
  useEffect(() => {
    setSearchValue(search);
    setIsPending(false);
  }, [search, ageMin, ageMax, categoryId, cityId, price, sort]);

  // Cerrar dropdown al clic fuera — también limpiar sugerencias para evitar
  // que reaparezcan en el siguiente onFocus con valor corto en el input
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSugg(false);
        setSuggestions([]);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Bloquear scroll cuando el modal está abierto
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // ── Navegación ─────────────────────────────────────────────────────────────

  const navigate = useCallback((params: Record<string, string>) => {
    setIsPending(true);
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
    sp.delete('page');
    router.push(`${pathname}?${sp.toString()}`);
  }, [router, pathname]);

  // ── Autocompletado ─────────────────────────────────────────────────────────
  // AbortController cancela el fetch en vuelo cuando el usuario borra el texto
  // antes de que llegue la respuesta — evita mostrar sugerencias obsoletas.

  function fetchSuggestions(value: string) {
    if (suggestDebRef.current) clearTimeout(suggestDebRef.current);
    // Cancelar fetch anterior si sigue en vuelo
    if (fetchControllerRef.current) fetchControllerRef.current.abort();
    setSuggError(false);
    if (value.length < 3) { setSuggestions([]); setShowSugg(false); return; }
    suggestDebRef.current = setTimeout(async () => {
      const controller = new AbortController();
      fetchControllerRef.current = controller;
      try {
        const res  = await fetch(
          `/api/activities/suggestions?q=${encodeURIComponent(value)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setShowSugg((data.suggestions ?? []).length > 0);
        setActiveIndex(-1);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return; // fetch cancelado, ignorar
        setSuggestions([]);
        setShowSugg(false);
        setSuggError(true);
      }
    }, 200);
  }

  function selectSuggestion(s: Suggestion) {
    setShowSugg(false); setSuggestions([]); setActiveIndex(-1);
    router.push(activityPath(s.id, s.title));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSugg || suggestions.length === 0) {
      if (e.key === 'Enter') { e.preventDefault(); handleSearchSubmit(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) selectSuggestion(suggestions[activeIndex]);
      else handleSearchSubmit();
    } else if (e.key === 'Escape') {
      setShowSugg(false);
      setSuggestions([]); // limpiar para que no reaparezcan en el siguiente onFocus
      setActiveIndex(-1);
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

  // ── Handlers desktop ───────────────────────────────────────────────────────

  const currentAgeIdx = AGE_OPTIONS.findIndex(o => o.min === ageMin && o.max === ageMax);
  const ageIndex = currentAgeIdx === -1 ? 0 : currentAgeIdx;

  function handleAge(index: number) {
    const o = AGE_OPTIONS[index];
    navigate({ search: searchValue, ageMin: o.min, ageMax: o.max, categoryId, cityId, type, audience, price, sort });
  }
  function handleCategory(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId: value, cityId, type, audience, price, sort });
  }
  function handleCity(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId: value, type, audience, price, sort });
  }
  function handlePriceToggle(value: 'free' | 'paid') {
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId, type, audience, price: price === value ? '' : value, sort });
  }
  function handleSort(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId, type, audience, price, sort: value });
  }
  function handleReset() {
    setSearchValue('');
    navigate({});
  }

  // ── Modal mobile ───────────────────────────────────────────────────────────

  function openMobile() {
    setMobileAgeIdx(ageIndex);
    setMobileCatId(categoryId);
    setMobileCityId(cityId);
    setMobilePrice(price);
    setMobileSort(sort);
    setMobileOpen(true);
  }
  function clearMobile() {
    setMobileAgeIdx(0); setMobileCatId(''); setMobileCityId(''); setMobilePrice(''); setMobileSort('relevance');
  }
  function applyMobile() {
    const o = AGE_OPTIONS[mobileAgeIdx];
    navigate({ search: searchValue, ageMin: o.min, ageMax: o.max, categoryId: mobileCatId, cityId: mobileCityId, type, audience, price: mobilePrice, sort: mobileSort });
    setMobileOpen(false);
  }

  // ── Chips activos ──────────────────────────────────────────────────────────

  const categoryName = facets.validCategories.find(c => c.id === categoryId)?.name;
  const cityName     = facets.availableCities.find(c => c.id === cityId)?.name;
  const ageName      = ageIndex !== 0 ? AGE_OPTIONS[ageIndex]?.label : null;
  const priceName    = price === 'free' ? 'Gratis' : price === 'paid' ? 'De pago' : null;

  type Chip = { key: string; label: string; onRemove: () => void };
  // Orden fijo: Ubicación → Categoría → Precio → Edad
  const chips: Chip[] = ([
    cityName     && { key: 'city',     label: cityName,     onRemove: () => handleCity('')     },
    categoryName && { key: 'category', label: categoryName, onRemove: () => handleCategory('') },
    priceName    && { key: 'price',    label: priceName,    onRemove: () => handlePriceToggle(price as 'free' | 'paid') },
    ageName      && { key: 'age',      label: ageName,      onRemove: () => handleAge(0)       },
  ] as (Chip | false)[]).filter((c): c is Chip => Boolean(c));

  const hasFilters = !!(search || ageMin || ageMax || categoryId || cityId || price || (sort && sort !== 'relevance'));
  const mobileHasChanges = !!(mobileCatId || mobileCityId || mobilePrice || mobileAgeIdx !== 0 || mobileSort !== 'relevance');

  // ── Estilos ────────────────────────────────────────────────────────────────

  function selectCls(active: boolean) {
    const base = 'rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors cursor-pointer';
    return `${base} ${active
      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium focus:ring-indigo-100'
      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 focus:border-indigo-400 focus:ring-indigo-100'
    }`;
  }

  function pillCls(active: boolean) {
    return `px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer whitespace-nowrap ${
      active
        ? 'bg-indigo-600 text-white border-indigo-600'
        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
    }`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* BUSCADOR — prominente, full-width                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="relative" ref={searchContainerRef}>

        {/* Ícono lupa */}
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base pointer-events-none select-none">
          🔍
        </span>

        <input
          type="text"
          value={searchValue}
          onChange={e => handleSearchChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setShowSugg(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Busca por actividad, edad o ubicación…"
          autoComplete="off"
          aria-label="Buscar actividades"
          aria-autocomplete="list"
          aria-expanded={showSugg}
          className={`w-full rounded-2xl border bg-white py-3.5 pl-12 pr-12 text-base placeholder:text-gray-400 text-gray-900
            focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all
            ${isPending
              ? 'border-indigo-300 shadow-sm opacity-80'
              : 'border-gray-200 shadow-sm hover:border-gray-300 focus:border-indigo-400'
            }`}
        />

        {/* Spinner de carga (visible durante navegación) */}
        {isPending && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2">
            <Spinner />
          </span>
        )}

        {/* Dropdown de sugerencias */}
        {showSugg && suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-gray-100 bg-white shadow-xl overflow-hidden"
          >
            {suggestions.map((s, i) => (
              <li
                key={s.id}
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(-1)}
                onClick={() => selectSuggestion(s)}
                className={`flex items-center gap-2 px-4 py-3 cursor-pointer text-sm transition-colors ${
                  i === activeIndex ? 'bg-indigo-50 text-indigo-900' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex-1 truncate">
                  <span className="font-medium">{highlightMatch(s.title, searchValue)}</span>
                  {s.category && (
                    <span className="ml-2 text-xs text-gray-400">{s.category}</span>
                  )}
                </span>
                <span className="shrink-0 text-gray-300 text-xs">→</span>
              </li>
            ))}
            <li className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 select-none">
              ↑↓ navegar · Enter ir a actividad · Esc cerrar
            </li>
          </ul>
        )}

        {/* Error estado sugerencias (sutil) */}
        {suggError && searchValue.length >= 3 && (
          <p className="absolute left-0 top-full mt-1 text-xs text-red-400 px-1">
            No se pudieron cargar sugerencias
          </p>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* CONTROLES — desktop                                                */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="hidden sm:flex items-center gap-2 flex-wrap">

        {/* Categoría */}
        <select
          value={categoryId}
          onChange={e => handleCategory(e.target.value)}
          className={selectCls(!!categoryId)}
          aria-label="Categoría"
        >
          <option value="">Categoría</option>
          {facets.validCategories.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c._count.activities})</option>
          ))}
        </select>

        {/* Precio — pills independientes */}
        <div
          className="flex rounded-xl border border-gray-200 bg-white p-1 gap-1"
          role="group"
          aria-label="Precio"
        >
          <button
            type="button"
            onClick={() => handlePriceToggle('free')}
            className={pillCls(price === 'free')}
          >
            Gratis
            {facets.priceCounts.free > 0 && price !== 'free' && (
              <span className="ml-1 text-xs opacity-50">({facets.priceCounts.free})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handlePriceToggle('paid')}
            className={pillCls(price === 'paid')}
          >
            De pago
            {facets.priceCounts.paid > 0 && price !== 'paid' && (
              <span className="ml-1 text-xs opacity-50">({facets.priceCounts.paid})</span>
            )}
          </button>
        </div>

        {/* Ubicación — solo si hay más de 1 ciudad */}
        {facets.availableCities.length > 1 && (
          <select
            value={cityId}
            onChange={e => handleCity(e.target.value)}
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
          onChange={e => handleAge(Number(e.target.value))}
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
          onChange={e => handleSort(e.target.value)}
          className={selectCls(sort !== 'relevance')}
          aria-label="Ordenar por"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Separador + Limpiar filtros */}
        {hasFilters && (
          <>
            <span className="w-px h-5 bg-gray-200 mx-1" aria-hidden="true" />
            <button
              type="button"
              onClick={handleReset}
              className="text-sm text-gray-400 hover:text-gray-700 underline underline-offset-2 whitespace-nowrap transition-colors"
            >
              Limpiar filtros
            </button>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* CONTROLES — mobile: botón "Filtros"                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="flex sm:hidden gap-2">
        <button
          type="button"
          onClick={openMobile}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
            hasFilters
              ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          {/* Ícono filtros */}
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 12h12M10 20h4" />
          </svg>
          Filtros
          {chips.length > 0 && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold">
              {chips.length}
            </span>
          )}
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors self-center"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* CHIPS activos — en desktop y mobile (siempre fuera del modal)     */}
      {/* Orden fijo: Ubicación → Categoría → Precio → Edad                 */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {chips.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          {chips.map(chip => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`Quitar filtro ${chip.label}`}
                className="ml-0.5 text-indigo-400 hover:text-indigo-700 transition-colors leading-none"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* CONTEO de resultados                                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <p className={`text-sm transition-opacity ${isPending ? 'opacity-40' : 'opacity-100'}`}>
        {isPending ? (
          <span className="text-gray-400 flex items-center gap-1.5">
            <Spinner className="inline" />
            Buscando…
          </span>
        ) : total === 0 ? (
          <span className="text-gray-500">
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
          </span>
        ) : (
          <span className="text-gray-500">
            <span className="font-semibold text-gray-700">{total.toLocaleString('es-CO')}</span>
            {' '}actividad{total !== 1 ? 'es' : ''} encontrada{total !== 1 ? 's' : ''}
          </span>
        )}
      </p>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL MOBILE — full-screen con temp state                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-white sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filtros"
        >
          {/* Header modal */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">Filtros</h2>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar filtros"
              className="text-gray-400 hover:text-gray-700 transition-colors text-xl leading-none w-8 h-8 flex items-center justify-center"
            >
              ✕
            </button>
          </div>

          {/* Contenido desplazable */}
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-7">

            {/* Categoría */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Categoría</label>
              <select
                value={mobileCatId}
                onChange={e => setMobileCatId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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
              <div className="grid grid-cols-2 gap-2">
                {(['free', 'paid'] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMobilePrice(p => p === v ? '' : v)}
                    className={`rounded-xl border py-3 text-sm font-medium transition-colors ${
                      mobilePrice === v
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300'
                    }`}
                  >
                    {v === 'free' ? 'Gratis' : 'De pago'}
                  </button>
                ))}
              </div>
            </div>

            {/* Ubicación */}
            {facets.availableCities.length > 1 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ubicación</label>
                <select
                  value={mobileCityId}
                  onChange={e => setMobileCityId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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
              <div className="flex flex-col gap-2">
                {SORT_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setMobileSort(o.value)}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-medium text-left transition-colors ${
                      mobileSort === o.value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {o.label}
                    {mobileSort === o.value && (
                      <span className="float-right text-indigo-500">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer fijo */}
          <div className="border-t border-gray-100 px-5 py-4 flex gap-3 bg-white">
            <button
              type="button"
              onClick={clearMobile}
              disabled={!mobileHasChanges}
              className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={applyMobile}
              className="flex-[2] rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
