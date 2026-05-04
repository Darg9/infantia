'use client';
import { Button } from '@/components/ui';

// =============================================================================
// Filters — cabecera de resultados de /actividades
//
// Input: lupa clickeable, debounce 300ms, placeholder "Busca por actividad…"
// Dropdown: mixto (actividades + categorías + ciudades), máx 5 ítems,
//   primer ítem preseleccionado, cache en memoria, historial en sessionStorage,
//   skeleton de carga, estado vacío, footer de teclado (solo desktop).
// Desktop: [Input] → [Categoría▼] [Gratis|De pago] [Edad▼] [Ordenar▼] [Limpiar]
//          → [Chips activos]  → [N actividades]
// Mobile:  [Input] [Filtros▼ badge] → modal full-screen con temp state
// =============================================================================

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { activityPath } from '@/lib/activity-url';
import { trackFilterApplied } from '@/lib/track';
import type { SuggestionItem } from '@/app/api/activities/suggestions/route';

// ── Interfaces ────────────────────────────────────────────────────────────────

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
  /** Nombre estable de la categoría seleccionada (desde el servidor, no de la lista facetada) */
  selectedCategoryName?: string;
  /** Nombre estable de la ciudad seleccionada (desde el servidor, no de la lista facetada) */
  selectedCityName?: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'relevance',  label: 'Recomendado'   },
  { value: 'newest',     label: 'Más recientes' },
] as const;

const AGE_OPTIONS = [
  { label: 'Cualquier edad', min: '', max: '' },
  { label: '0–3 años',       min: '0',  max: '3'  },
  { label: '4–6 años',       min: '4',  max: '6'  },
  { label: '7–10 años',      min: '7',  max: '10' },
  { label: '11–14 años',     min: '11', max: '14' },
  { label: '15–18 años',     min: '15', max: '18' },
];

/** Labels para el filtro de tipo de actividad */
const TYPE_LABELS: Record<string, string> = {
  ONE_TIME:  'Evento único',
  RECURRING: 'Clases regulares',
  WORKSHOP:  'Taller',
  CAMP:      'Campamento',
};

/** Labels para el filtro de audiencia */
const AUDIENCE_LABELS: Record<string, string> = {
  KIDS:   'Solo niños',
  FAMILY: 'Familias',
  ADULTS: 'Adultos',
};

const HISTORY_KEY = 'hp_recent_searches';
const HISTORY_MAX = 5;
const CACHE_MAX   = 20;

// ── Skeleton (Suspense fallback) ──────────────────────────────────────────────

export function FiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      <div className="h-14 rounded-2xl bg-[var(--hp-bg-subtle)] w-full" />
      <div className="hidden sm:flex gap-2">
        <div className="h-9 rounded-xl bg-[var(--hp-bg-subtle)] w-36" />
        <div className="h-9 rounded-xl bg-[var(--hp-bg-subtle)] w-40" />
        <div className="h-9 rounded-xl bg-[var(--hp-bg-subtle)] w-28" />
        <div className="h-9 rounded-xl bg-[var(--hp-bg-subtle)] w-32" />
      </div>
      <div className="h-4 rounded bg-[var(--hp-bg-subtle)] w-44" />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Resalta la parte del texto que coincide con el query */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-brand-50 text-brand-700 rounded px-0.5 not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/** Icono por tipo de sugerencia */
function SuggIcon({ type }: { type: SuggestionItem['type'] }) {
  if (type === 'category') return <span aria-hidden>📂</span>;
  if (type === 'city')     return <span aria-hidden>📍</span>;
  return                          <span aria-hidden>🎯</span>;
}

/** Spinner animado */
function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${className}`} fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Filters({
  search, ageMin, ageMax, categoryId, cityId, type, audience, price, sort, facets, total,
  selectedCategoryName, selectedCityName,
}: FiltersProps) {
  const router   = useRouter();
  const pathname = usePathname();

  // ── Search state ──────────────────────────────────────────────────────────
  const [searchValue, setSearchValue]     = useState(search);
  const [suggestions, setSuggestions]     = useState<SuggestionItem[]>([]);
  const [activeIndex, setActiveIndex]     = useState(-1);
  const [showSugg, setShowSugg]           = useState(false);    // results visible
  const [showHistory, setShowHistory]     = useState(false);    // history visible
  const [isFetchingSugg, setIsFetching]   = useState(false);    // skeleton visible
  const [suggError, setSuggError]         = useState(false);
  const [recentSearches, setRecent]       = useState<string[]>([]);

  // ── Navigation loading ────────────────────────────────────────────────────
  const [isPending, setIsPending] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const debounceRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestDebRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchCtrlRef      = useRef<AbortController | null>(null);
  const cacheRef          = useRef<Map<string, SuggestionItem[]>>(new Map());
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // ── Mobile modal ──────────────────────────────────────────────────────────
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [mobileAgeIdx, setMobileAgeIdx] = useState(0);
  const [mobileCatId, setMobileCatId]   = useState('');
  const [mobileCityId, setMobileCityId] = useState('');
  const [mobilePrice, setMobilePrice]   = useState('');
  const [mobileSort, setMobileSort]     = useState('relevance');

  // ── Efectos ───────────────────────────────────────────────────────────────

  // Cargar historial desde sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(HISTORY_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
  }, []);

  // Limpiar isPending cuando llegan nuevos props (navegación completada) +
  // Disparar evento filter_applied con el conteo real (post-SSR).
  // IMPORTANTE: El disparo se hace AQUÍ y no en los handleXxx, porque:
  //   1. `total` en Filters refleja el conteo del render ACTUAL (no del siguiente)
  //   2. Los handleXxx navégan via router.push; el resultado llega en el próximo render
  //   3. Este useEffect corre DESPUÉS del re-render, cuando `total` ya es el nuevo conteo
  const prevFiltersRef = useRef<{
    categoryId: string; cityId: string; price: string;
    ageMin: string; ageMax: string; type: string;
    audience: string; sort: string;
  } | null>(null);

  useEffect(() => {
    setSearchValue(search);
    setIsPending(false);

    const prev = prevFiltersRef.current;
    const currentPath = pathname + (typeof window !== 'undefined' ? window.location.search : '');

    // No trackear en el mount inicial (prev es null)
    if (prev !== null) {
      // Detectar qué filtro cambió de forma atómica (un evento por interacción)
      if (categoryId !== prev.categoryId && categoryId) {
        const label = facets.validCategories.find(c => c.id === categoryId)?.name ?? categoryId;
        trackFilterApplied({ filterType: 'category', filterValue: label, resultsCount: total, query: search || undefined, path: currentPath });
      } else if (cityId !== prev.cityId && cityId) {
        const label = facets.availableCities.find(c => c.id === cityId)?.name ?? cityId;
        trackFilterApplied({ filterType: 'city', filterValue: label, resultsCount: total, query: search || undefined, path: currentPath });
      } else if (price !== prev.price && price) {
        trackFilterApplied({ filterType: 'price', filterValue: price, resultsCount: total, query: search || undefined, path: currentPath });
      } else if ((ageMin !== prev.ageMin || ageMax !== prev.ageMax) && (ageMin || ageMax)) {
        const ageLabel = AGE_OPTIONS.find(o => o.min === ageMin && o.max === ageMax)?.label ?? `${ageMin}-${ageMax}`;
        trackFilterApplied({ filterType: 'age', filterValue: ageLabel, resultsCount: total, query: search || undefined, path: currentPath });
      } else if (type !== prev.type && type) {
        const typeLabel = TYPE_LABELS[type] ?? type;
        trackFilterApplied({ filterType: 'type', filterValue: typeLabel, resultsCount: total, query: search || undefined, path: currentPath });
      } else if (audience !== prev.audience && audience) {
        const audienceLabel = AUDIENCE_LABELS[audience] ?? audience;
        trackFilterApplied({ filterType: 'audience', filterValue: audienceLabel, resultsCount: total, query: search || undefined, path: currentPath });
      } else if (sort !== prev.sort && sort !== 'relevance') {
        const sortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? sort;
        trackFilterApplied({ filterType: 'sort', filterValue: sortLabel, resultsCount: total, query: search || undefined, path: currentPath });
      }
    }

    // Actualizar referencia para la siguiente comparación
    prevFiltersRef.current = { categoryId, cityId, price, ageMin, ageMax, type, audience, sort };
  }, [search, ageMin, ageMax, categoryId, cityId, price, sort, type, audience, total]);
  // ↑ `total` en las deps es intencional: garantiza que el disparo usa el conteo post-SSR correcto.

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Bloquear scroll del body cuando modal mobile está abierto
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // ── Helpers dropdown ──────────────────────────────────────────────────────

  function closeDropdown() {
    setShowSugg(false);
    setShowHistory(false);
    setSuggestions([]);
    setActiveIndex(-1);
    setIsFetching(false);
    setSuggError(false);
  }

  function isDropdownVisible() {
    return showSugg || showHistory || isFetchingSugg;
  }

  // ── Historial de búsquedas ─────────────────────────────────────────────────

  function saveToHistory(q: string) {
    if (!q || q.trim().length < 3) return;
    setRecent(prev => {
      const updated = [q.trim(), ...prev.filter(r => r !== q.trim())].slice(0, HISTORY_MAX);
      try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }

  function selectHistory(term: string) {
    setSearchValue(term);
    closeDropdown();
    navigate({ search: term, ageMin, ageMax, categoryId, cityId, type, audience, price, sort });
  }

  // ── Navegación ────────────────────────────────────────────────────────────

  const navigate = useCallback((params: Record<string, string>) => {
    setIsPending(true);
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
    sp.delete('page');
    router.push(`${pathname}?${sp.toString()}`);
  }, [router, pathname]);

  // ── Autocompletado ────────────────────────────────────────────────────────

  function fetchSuggestions(value: string) {
    // Cancelar debounce y fetch previos
    if (suggestDebRef.current) clearTimeout(suggestDebRef.current);
    if (fetchCtrlRef.current) fetchCtrlRef.current.abort();
    setSuggError(false);

    if (value.length < 3) {
      setSuggestions([]);
      setShowSugg(false);
      setIsFetching(false);
      // Mostrar historial si hay búsquedas recientes
      if (recentSearches.length > 0) setShowHistory(true);
      return;
    }

    setShowHistory(false);

    // Cache hit: mostrar instantáneamente
    const cached = cacheRef.current.get(value);
    if (cached) {
      setSuggestions(cached);
      setShowSugg(true);
      setIsFetching(false);
      setActiveIndex(cached.length > 0 ? 0 : -1);
      return;
    }

    // Iniciar skeleton inmediatamente (antes del debounce)
    setIsFetching(true);
    setShowSugg(false);

    suggestDebRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      fetchCtrlRef.current = ctrl;
      try {
        const res  = await fetch(
          `/api/activities/suggestions?q=${encodeURIComponent(value)}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        const list: SuggestionItem[] = data.suggestions ?? [];

        // Guardar en cache (LRU simple: eliminar la entrada más antigua)
        cacheRef.current.set(value, list);
        if (cacheRef.current.size > CACHE_MAX) {
          const oldest = cacheRef.current.keys().next().value;
          if (oldest) cacheRef.current.delete(oldest);
        }

        setSuggestions(list);
        setShowSugg(true);
        setIsFetching(false);
        setActiveIndex(list.length > 0 ? 0 : -1); // Preseleccionar primer ítem
      } catch (err) {
        if ((err as Error).name === 'AbortError') return; // Cancelado, ignorar
        setSuggestions([]);
        setShowSugg(false);
        setIsFetching(false);
        setSuggError(true);
      }
    }, 300); // 300ms debounce
  }

  function selectSuggestion(s: SuggestionItem) {
    closeDropdown();
    if (s.type === 'activity') {
      saveToHistory(searchValue);
      router.push(activityPath(s.id, s.label));
    } else if (s.type === 'category') {
      handleCategory(s.id);
    } else if (s.type === 'city') {
      handleCity(s.id);
    }
  }

  function handleSearchSubmit() {
    closeDropdown();
    saveToHistory(searchValue);
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId, type, audience, price, sort });
  }

  function handleSearchChange(value: string) {
    setSearchValue(value);
    fetchSuggestions(value);
    // Debounce para actualizar los resultados de la página
    // Solo navegar si el campo está vacío (limpiar) o tiene ≥ 3 caracteres
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length > 0 && value.length < 3) return; // esperar más caracteres
    debounceRef.current = setTimeout(() => {
      navigate({ search: value, ageMin, ageMax, categoryId, cityId, type, audience, price, sort });
      if (value.trim().length >= 3) {
        fetch('/api/search/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: value.trim(), resultCount: total }),
        }).catch(() => {});
      }
    }, 400); // Navegación con debounce ligeramente mayor
  }

  // ── Teclado ───────────────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const visible = isDropdownVisible();

    if (e.key === 'ArrowDown') {
      if (!visible) return;
      e.preventDefault();
      const max = showSugg ? suggestions.length - 1 : showHistory ? recentSearches.length - 1 : -1;
      setActiveIndex(i => Math.min(i + 1, max));
    } else if (e.key === 'ArrowUp') {
      if (!visible) return;
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1)); // -1 = sin selección → Enter envía texto
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showSugg && activeIndex >= 0 && suggestions[activeIndex]) {
        selectSuggestion(suggestions[activeIndex]);
      } else if (showHistory && activeIndex >= 0 && recentSearches[activeIndex]) {
        selectHistory(recentSearches[activeIndex]);
      } else {
        handleSearchSubmit();
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  }

  // ── Handlers de filtros (desktop) ─────────────────────────────────────────

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
  function handlePrice(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId, type, audience, price: value, sort });
  }
  function handleSort(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId, type, audience, price, sort: value });
  }
  function handleType(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId, type: value, audience, price, sort });
  }
  function handleAudience(value: string) {
    navigate({ search: searchValue, ageMin, ageMax, categoryId, cityId, type, audience: value, price, sort });
  }
  function handleReset() {
    setSearchValue('');
    navigate({});
  }

  // ── Mobile modal ──────────────────────────────────────────────────────────

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

  // ── Chips activos ─────────────────────────────────────────────────────────

  // IMPORTANT: Usamos los nombres estables del servidor (selectedCategoryName/selectedCityName)
  // para evitar que el chip desaparezca cuando la lista facetada restringe las opciones.
  // Fallback a la búsqueda en facets por compatibilidad.
  const categoryName = selectedCategoryName ?? facets.validCategories.find(c => c.id === categoryId)?.name;
  const cityName     = selectedCityName     ?? facets.availableCities.find(c => c.id === cityId)?.name;
  const ageName      = ageIndex !== 0 ? AGE_OPTIONS[ageIndex]?.label : null;
  const priceName    = price === 'free' ? 'Gratis' : price === 'paid' ? 'De pago' : null;
  const typeName     = type ? (TYPE_LABELS[type] ?? type) : null;
  const audienceName = audience ? (AUDIENCE_LABELS[audience] ?? audience) : null;

  type Chip = { key: string; label: string; onRemove: () => void };
  const chips: Chip[] = ([
    cityName     && { key: 'city',     label: cityName,     onRemove: () => handleCity('')       },
    categoryName && { key: 'category', label: categoryName, onRemove: () => handleCategory('')   },
    priceName    && { key: 'price',    label: priceName,    onRemove: () => handlePrice('')      },
    ageName      && { key: 'age',      label: ageName,      onRemove: () => handleAge(0)         },
    typeName     && { key: 'type',     label: typeName,     onRemove: () => handleType('')       },
    audienceName && { key: 'audience', label: audienceName, onRemove: () => handleAudience('')   },
  ] as (Chip | false)[]).filter((c): c is Chip => Boolean(c));

  const hasFilters = !!(search || ageMin || ageMax || categoryId || cityId || price || type || audience || (sort && sort !== 'relevance'));
  const mobileHasChanges = !!(mobileCatId || mobileCityId || mobilePrice || mobileAgeIdx !== 0 || mobileSort !== 'relevance');

  // ── Estilos ───────────────────────────────────────────────────────────────

  function selectCls(active: boolean) {
    const base = 'rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors cursor-pointer';
    return `${base} ${active
      ? 'border-brand-500 bg-[var(--hp-bg-subtle)] text-brand-700 font-medium focus:ring-brand-100'
      : 'border-[var(--hp-border)] bg-[var(--hp-bg-surface)] text-[var(--hp-text-secondary)] hover:border-[var(--hp-border-subtle)] focus:border-brand-400 focus:ring-brand-100'
    }`;
  }

  // ── Contenido del dropdown ────────────────────────────────────────────────
  // Determinamos qué mostrar sin bloquear el render

  const dropdownVisible = showSugg || showHistory || isFetchingSugg;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* BUSCADOR prominente + dropdown                                   */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="relative" ref={searchContainerRef}>

        {/* Lupa — clickeable, dispara búsqueda */}
        <Button
          type="button"
          size="icon"
          onClick={handleSearchSubmit}
          aria-label="Buscar"
          className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--hp-text-muted)] hover:text-brand-500 transition-colors z-10"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </Button>

        {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props -- aria-expanded en input de búsqueda es patrón combobox estándar */}
        <input
          type="text"
          value={searchValue}
          onChange={e => handleSearchChange(e.target.value)}
          onFocus={() => {
            if (searchValue.length < 3) {
              if (recentSearches.length > 0) setShowHistory(true);
            } else if (suggestions.length > 0) {
              setShowSugg(true);
            } else if (!isFetchingSugg) {
              fetchSuggestions(searchValue);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Busca por actividad, edad o ubicación…"
          autoComplete="off"
          spellCheck={false}
          aria-label="Buscar actividades"
          aria-autocomplete="list"
          aria-expanded={dropdownVisible}
          aria-haspopup="listbox"
          className={`w-full rounded-2xl border bg-[var(--hp-bg-surface)] py-3.5 pl-12 pr-12 text-base placeholder:text-[var(--hp-text-muted)] text-[var(--hp-text-primary)] focus:outline-none focus:ring-2 transition-all shadow-[var(--hp-shadow-md)]${isPending
              ? 'border-brand-300 opacity-80 focus:ring-brand-100'
              : 'border-[var(--hp-border)] hover:border-[var(--hp-border-subtle)] focus:border-brand-500 focus:ring-brand-100'
            }`}
        />

        {/* Spinner de navegación (derecha) */}
        {isPending && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-400">
            <Spinner />
          </span>
        )}

        {/* ── Dropdown ──────────────────────────────────────────────── */}
        {dropdownVisible && (
          <div
            role="listbox"
            aria-label="Sugerencias de búsqueda"
            // onMouseDown preventDefault evita que el input pierda el foco al hacer clic en el dropdown
            onMouseDown={e => e.preventDefault()}
            className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] shadow-xl overflow-hidden"
          >

            {/* ── Historial de búsquedas ──────────────────────────── */}
            {showHistory && recentSearches.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-[var(--hp-text-muted)] uppercase tracking-wide select-none">
                  Búsquedas recientes
                </p>
                <ul>
                  {recentSearches.map((term, i) => (
                    <li
                      key={term}
                      role="option"
                      aria-selected={i === activeIndex}
                      onMouseEnter={() => setActiveIndex(i)}
                      onMouseLeave={() => setActiveIndex(-1)}
                      onClick={() => selectHistory(term)}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                        i === activeIndex ? 'bg-[var(--hp-bg-subtle)] text-[var(--hp-text-primary)]' : 'text-[var(--hp-text-primary)] hover:bg-[var(--hp-bg-page)]'
                      }`}
                    >
                      <svg className="w-4 h-4 shrink-0 text-[var(--hp-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="flex-1 truncate">{term}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* ── Skeleton de carga ────────────────────────────────── */}
            {isFetchingSugg && (
              <ul className="animate-pulse divide-y divide-[var(--hp-border)]">
                {[1, 2, 3].map(i => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-5 h-5 rounded-full bg-[var(--hp-bg-subtle)] shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-[var(--hp-bg-subtle)] rounded-full" style={{ width: `${50 + i * 15}%` }} />
                      <div className="h-2.5 bg-[var(--hp-bg-subtle)] rounded-full w-1/4" />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* ── Sin resultados ───────────────────────────────────── */}
            {!isFetchingSugg && showSugg && suggestions.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-[var(--hp-text-secondary)]">
                  No encontramos resultados para{' '}
                  <span className="font-medium text-[var(--hp-text-primary)]">&quot;{searchValue}&quot;</span>
                </p>
                <p className="text-xs text-[var(--hp-text-muted)] mt-1">
                  Intenta con otras palabras o explora los filtros
                </p>
              </div>
            )}

            {/* ── Resultados mixtos ────────────────────────────────── */}
            {!isFetchingSugg && showSugg && suggestions.length > 0 && (
              <ul>
                {suggestions.map((s, i) => (
                  <li
                    key={`${s.type}-${s.id}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseLeave={() => setActiveIndex(-1)}
                    onClick={() => selectSuggestion(s)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer text-sm transition-colors ${
                      i === activeIndex ? 'bg-[var(--hp-bg-subtle)]' : 'hover:bg-[var(--hp-bg-page)]'
                    }`}
                  >
                    {/* Ícono por tipo */}
                    <span className="text-base w-5 text-center shrink-0 select-none">
                      <SuggIcon type={s.type} />
                    </span>

                    {/* Texto principal + sublabel */}
                    <span className="flex-1 min-w-0">
                      <span className={`block truncate font-medium ${
                        i === activeIndex ? 'text-brand-900' : 'text-[var(--hp-text-primary)]'
                      }`}>
                        {highlightMatch(s.label, searchValue)}
                      </span>
                      {s.sublabel && (
                        <span className="text-xs text-[var(--hp-text-muted)] truncate block mt-0.5">
                          {s.sublabel}
                        </span>
                      )}
                    </span>

                    {/* Badge de tipo */}
                    {s.type !== 'activity' && (
                      <span className={`shrink-0 text-xs rounded-full px-2 py-0.5 font-medium ${
                        s.type === 'category'
                          ? 'bg-brand-50 text-brand-700'
                          : 'bg-success-50 text-success-600'
                      }`}>
                        {s.type === 'category' ? 'Categoría' : 'Ciudad'}
                      </span>
                    )}

                    {/* Flecha */}
                    <span className={`shrink-0 text-xs ${
                      i === activeIndex ? 'text-brand-400' : 'text-[var(--hp-text-muted)]'
                    }`}>→</span>
                  </li>
                ))}
              </ul>
            )}

            {/* ── Footer teclado — solo desktop, bajo contraste ────── */}
            {(showSugg && suggestions.length > 0) && (
              <div className="hidden sm:block px-4 py-2 text-xs text-[var(--hp-text-muted)] border-t border-[var(--hp-border)] select-none">
                ↑↓ navegar · Enter seleccionar · Esc cerrar
              </div>
            )}

            {/* ── Error de sugerencias ─────────────────────────────── */}
            {suggError && (
              <div className="px-4 py-3 text-xs text-error-400 text-center">
                No se pudieron cargar sugerencias
              </div>
            )}
          </div>
        )}
      </div>
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* CONTROLES DESKTOP                                               */}
      {/* ════════════════════════════════════════════════════════════════ */}
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

        {/* Precio */}
        <select
          value={price}
          onChange={e => handlePrice(e.target.value)}
          className={selectCls(!!price)}
          aria-label="Precio"
        >
          <option value="">Cualquier precio</option>
          <option value="free">
            Solo gratis {facets.priceCounts.free > 0 && price !== 'free' ? `(${facets.priceCounts.free})` : ''}
          </option>
          <option value="paid">
            Con precio visible {facets.priceCounts.paid > 0 && price !== 'paid' ? `(${facets.priceCounts.paid})` : ''}
          </option>
        </select>

        {/* Ciudad */}
        {facets.availableCities.length > 1 && (
          <select
            value={cityId}
            onChange={e => handleCity(e.target.value)}
            className={selectCls(!!cityId)}
            aria-label="Ciudad"
          >
            <option value="">Todas las ciudades</option>
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

        {/* Limpiar filtros y Conteo */}
        {hasFilters && (
          <>
            <span className="w-px h-5 bg-[var(--hp-border)] mx-1" aria-hidden />
            <span className="text-xs font-bold text-brand-700 bg-[var(--hp-bg-subtle)] px-2.5 py-1 rounded-full">
               {chips.length} activo{chips.length !== 1 ? 's' : ''}
            </span>
            <Button
              type="button"
              onClick={handleReset}
              className="text-sm text-[var(--hp-text-muted)] hover:text-brand-500 underline underline-offset-2 whitespace-nowrap transition-colors"
            >
              Limpiar filtros
            </Button>
          </>
        )}
      </div>
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* CONTROLES MOBILE                                                 */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="flex sm:hidden gap-2">
        <Button
          type="button"
          onClick={openMobile}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
            hasFilters
              ? 'border-brand-400 bg-[var(--hp-bg-subtle)] text-brand-700'
              : 'border-[var(--hp-border)] bg-[var(--hp-bg-surface)] text-[var(--hp-text-secondary)] hover:border-[var(--hp-border-subtle)]'
          }`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 12h12M10 20h4" />
          </svg>
          Filtros
          {chips.length > 0 && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white text-xs font-bold">
              {chips.length}
            </span>
          )}
        </Button>
        {hasFilters && (
          <Button
            type="button"
            onClick={handleReset}
            className="text-sm text-[var(--hp-text-muted)] hover:text-[var(--hp-text-primary)] underline underline-offset-2 transition-colors self-center"
          >
            Limpiar
          </Button>
        )}
      </div>
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* CHIPS activos (Ubicación → Categoría → Precio → Edad)           */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {chips.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          {chips.map(chip => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-[var(--hp-bg-subtle)] px-3 py-1 text-sm font-medium text-brand-700"
            >
              {chip.label}
              <Button
                type="button"
                onClick={chip.onRemove}
                aria-label={`Quitar filtro ${chip.label}`}
                className="ml-0.5 text-brand-400 hover:text-brand-700 transition-colors leading-none"
              >
                ✕
              </Button>
            </span>
          ))}
        </div>
      )}
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* CONTEO de resultados                                             */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <p className={`text-sm transition-opacity ${isPending ? 'opacity-40' : 'opacity-100'}`}>
        {isPending ? (
          <span className="text-[var(--hp-text-muted)] flex items-center gap-1.5">
            <Spinner className="inline text-brand-400" />
            Buscando…
          </span>
        ) : total === 0 ? (
          <span className="text-[var(--hp-text-secondary)]">
            No hay actividades con estos filtros.{' '}
            {hasFilters && (
              <Button type="button" onClick={handleReset}
                className="text-brand-600 hover:underline font-medium">
                Limpiar filtros
              </Button>
            )}
          </span>
        ) : (
          <span className="text-[var(--hp-text-secondary)]">
            <span className="font-semibold text-[var(--hp-text-primary)]">{total.toLocaleString('es-CO')}</span>
            {' '}actividad{total !== 1 ? 'es' : ''} encontrada{total !== 1 ? 's' : ''}
            {cityName && (
              <> en <span className="font-medium text-[var(--hp-text-primary)]">{cityName}</span></>
            )}
          </span>
        )}
      </p>
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* MODAL MOBILE                                                     */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--hp-bg-surface)] sm:hidden" role="dialog" aria-modal aria-label="Filtros">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--hp-border)]">
            <h2 className="text-base font-bold text-[var(--hp-text-primary)]">Filtros</h2>
            <Button type="button" onClick={() => setMobileOpen(false)} aria-label="Cerrar filtros"
              className="text-[var(--hp-text-muted)] hover:text-[var(--hp-text-primary)] transition-colors text-xl leading-none w-8 h-8 flex items-center justify-center">
              ✕
            </Button>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-7">

            <div>
              <label className="block text-sm font-semibold text-[var(--hp-text-primary)] mb-2">Categoría</label>
              <select value={mobileCatId} onChange={e => setMobileCatId(e.target.value)}
                className="w-full rounded-xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] px-3 py-3 text-sm text-[var(--hp-text-primary)] focus:border-brand-500 focus:outline-none">
                <option value="">Todas las categorías</option>
                {facets.validCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c._count.activities})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--hp-text-primary)] mb-2">Precio</label>
              <select value={mobilePrice} onChange={e => setMobilePrice(e.target.value)}
                className="w-full rounded-xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] px-3 py-3 text-sm text-[var(--hp-text-primary)] focus:border-brand-500 focus:outline-none">
                <option value="">Cualquier precio</option>
                <option value="free">Solo gratis</option>
                <option value="paid">Con precio visible</option>
              </select>
            </div>

            {facets.availableCities.length > 1 && (
              <div>
                <label className="block text-sm font-semibold text-[var(--hp-text-primary)] mb-2">Ubicación</label>
                <select value={mobileCityId} onChange={e => setMobileCityId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] px-3 py-3 text-sm text-[var(--hp-text-primary)] focus:border-brand-500 focus:outline-none">
                  <option value="">Todas las ciudades</option>
                  {facets.availableCities.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-[var(--hp-text-primary)] mb-2">Edad</label>
              <div className="grid grid-cols-2 gap-2">
                {AGE_OPTIONS.map((o, i) => (
                  <Button key={i} type="button" onClick={() => setMobileAgeIdx(i)}
                    className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                      mobileAgeIdx === i
                        ? 'border-brand-500 bg-brand-600 text-white'
                        : 'border-[var(--hp-border)] bg-[var(--hp-bg-surface)] text-[var(--hp-text-primary)] hover:border-brand-300'
                    }`}>
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--hp-text-primary)] mb-2">Ordenar por</label>
              <div className="flex flex-col gap-2">
                {SORT_OPTIONS.map(o => (
                  <Button key={o.value} type="button" onClick={() => setMobileSort(o.value)}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-medium text-left transition-colors ${
                      mobileSort === o.value
                        ? 'border-brand-500 bg-[var(--hp-bg-subtle)] text-brand-700'
                        : 'border-[var(--hp-border)] bg-[var(--hp-bg-surface)] text-[var(--hp-text-primary)] hover:border-[var(--hp-border-subtle)]'
                    }`}>
                    {o.label}
                    {mobileSort === o.value && <span className="float-right text-brand-500">✓</span>}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--hp-border)] px-5 py-4 flex gap-3 bg-[var(--hp-bg-surface)]">
            <Button type="button" onClick={clearMobile} disabled={!mobileHasChanges}
              className="flex-1 rounded-xl border border-[var(--hp-border)] py-3 text-sm font-medium text-[var(--hp-text-secondary)] hover:bg-[var(--hp-bg-page)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Limpiar
            </Button>
            <Button type="button" onClick={applyMobile}
              className="flex-[2] rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 active:bg-brand-800 transition-colors">
              Aplicar filtros
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
