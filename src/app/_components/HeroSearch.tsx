'use client';

// =============================================================================
// HeroSearch — Buscador principal del hero de la home
// Client Component: autocompletado a partir del 3er carácter + chips rápidos
// =============================================================================

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { activityPath } from '@/lib/activity-url';

interface Suggestion {
  id: string;
  title: string;
  category: string | null;
}

const QUICK_CHIPS = [
  { label: 'Hoy',        href: '/actividades?sort=date'  },
  { label: 'Gratis',     href: '/actividades?price=free' },
  { label: 'Cerca de ti', href: '/mapa'                  },
] as const;

// Resalta el fragmento que coincide con el query
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

export default function HeroSearch() {
  const router = useRouter();
  const [query, setQuery]               = useState('');
  const [suggestions, setSuggestions]   = useState<Suggestion[]>([]);
  const [showSugg, setShowSugg]         = useState(false);
  const [activeIndex, setActiveIndex]   = useState(-1);
  const debounceRef                     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef                    = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSugg(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function fetchSuggestions(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 3) {
      setSuggestions([]);
      setShowSugg(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/activities/suggestions?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        const list = data.suggestions ?? [];
        setSuggestions(list);
        setShowSugg(list.length > 0);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
      }
    }, 200);
  }

  function handleChange(value: string) {
    setQuery(value);
    fetchSuggestions(value);
  }

  function submitSearch(q: string) {
    const trimmed = q.trim();
    setShowSugg(false);
    router.push(trimmed ? `/actividades?search=${encodeURIComponent(trimmed)}` : '/actividades');
  }

  function selectSuggestion(s: Suggestion) {
    setShowSugg(false);
    setSuggestions([]);
    setActiveIndex(-1);
    router.push(activityPath(s.id, s.title));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        selectSuggestion(suggestions[activeIndex]);
      } else {
        submitSearch(query);
      }
    } else if (e.key === 'Escape') {
      setShowSugg(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* ── Buscador ─────────────────────────────────────────────────── */}
      <div className="relative" ref={containerRef}>
        {/* Ícono lupa */}
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base pointer-events-none select-none">
          🔍
        </span>

        <input
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setShowSugg(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Ej: hoy, gratis, niños 5 años, talleres…"
          autoComplete="off"
          aria-label="Buscar actividades"
          aria-autocomplete="list"
          aria-expanded={showSugg}
          className="w-full rounded-2xl border border-gray-200 bg-white py-4 pl-12 pr-28 text-base text-gray-900 placeholder:text-gray-400 shadow-md focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-shadow"
        />

        <button
          onClick={() => submitSearch(query)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
        >
          Buscar
        </button>

        {/* ── Dropdown de autocompletado ──────────────────────────────── */}
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
                className={`flex items-center justify-between gap-2 px-4 py-3 cursor-pointer text-sm transition-colors ${
                  i === activeIndex
                    ? 'bg-indigo-50 text-indigo-900'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {/* Click en texto → búsqueda por término */}
                <span
                  className="flex-1 truncate"
                  onClick={() => {
                    setQuery(s.title);
                    submitSearch(s.title);
                  }}
                >
                  <span className="font-medium">{highlightMatch(s.title, query)}</span>
                  {s.category && (
                    <span className="ml-2 text-xs text-gray-400">{s.category}</span>
                  )}
                </span>
                {/* Flecha → va directo a la actividad */}
                <button
                  onClick={() => selectSuggestion(s)}
                  title="Ver actividad"
                  className="shrink-0 text-gray-300 hover:text-indigo-500 transition-colors px-1"
                  tabIndex={-1}
                >
                  →
                </button>
              </li>
            ))}
            <li className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 select-none">
              ↑↓ navegar · Enter buscar · Esc cerrar
            </li>
          </ul>
        )}
      </div>

      {/* ── Chips rápidos ────────────────────────────────────────────── */}
      <div className="flex gap-2 justify-center mt-3 flex-wrap">
        {QUICK_CHIPS.map(chip => (
          <button
            key={chip.label}
            onClick={() => router.push(chip.href)}
            className="rounded-full border border-gray-200 bg-white/80 px-4 py-1.5 text-sm text-gray-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-all"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
