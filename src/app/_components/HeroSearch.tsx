'use client';

// =============================================================================
// HeroSearch — Buscador principal del hero de la home
// Fases 1 & 2: Motor de búsqueda estructural
// =============================================================================

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { trackEvent } from '@/lib/track';
import { activityPath } from '@/lib/activity-url';
import type { SuggestionItem } from '@/app/api/activities/suggestions/route';
import { Input, Button, useToast } from '@/components/ui';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Search');

const QUICK_CHIPS = [
  { label: 'Hoy',         href: '/actividades?sort=date'  },
  { label: 'Gratis',      href: '/actividades?price=free' },
  { label: 'Cerca de ti', href: '/mapa'                   },
] as const;

// ── Hints Estructurales (Fase 2) ──────────────────────────────────────────────
type SearchHint = { text: string; href: string };
const HINTS: SearchHint[] = [
  { text: 'Gratis hoy en Bogotá',   href: '/actividades?price=free&sort=date&search=Bogot%C3%A1' },
  { text: 'Niños 5 años, ciencia',  href: '/actividades?ageMin=5&ageMax=5&search=ciencia' },
  { text: 'Talleres fin de semana', href: '/actividades?type=WORKSHOP&search=fin%20de%20semana' },
];

function useTypewriterHints() {
  const [index, setIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const current = HINTS[index].text;
    
    if (isDeleting) {
      if (displayText === '') {
        setIsDeleting(false);
        setIndex((prev) => (prev + 1) % HINTS.length);
        timer = setTimeout(() => {}, 500);
      } else {
        timer = setTimeout(() => setDisplayText(current.substring(0, displayText.length - 1)), 25); // 25ms delete
      }
    } else {
      if (displayText === current) {
        timer = setTimeout(() => setIsDeleting(true), 2500); // 2.5s pause
      } else {
        timer = setTimeout(() => setDisplayText(current.substring(0, displayText.length + 1)), 50); // 50ms type
      }
    }
    return () => clearTimeout(timer);
  }, [displayText, isDeleting, index]);

  return { hintText: displayText, currentHref: HINTS[index].href };
}

const HISTORY_KEY = 'hp_recent_searches';
const HISTORY_MAX = 5;
const CACHE_MAX   = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-brand-100 text-[var(--hp-text-primary)] rounded px-0.5 not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function SuggIcon({ type }: { type: SuggestionItem['type'] }) {
  if (type === 'category') return <span aria-hidden>📂</span>;
  if (type === 'city')     return <span aria-hidden>📍</span>;
  return                          <span aria-hidden>🎯</span>;
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function HeroSearch() {
  const router = useRouter();
  const { toast } = useToast();
  const { hintText, currentHref } = useTypewriterHints();

  const [query, setQuery]             = useState('');
  const [suggestions, setSugg]        = useState<SuggestionItem[]>([]);
  const [showSugg, setShowSugg]       = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isFetching, setIsFetching]   = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentSearches, setRecent]   = useState<string[]>([]);

  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchCtrlRef  = useRef<AbortController | null>(null);
  const cacheRef      = useRef<Map<string, SuggestionItem[]>>(new Map());
  const containerRef  = useRef<HTMLDivElement>(null);

  // Cargar historial
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(HISTORY_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
  }, []);

  function closeDropdown() {
    setShowSugg(false);
    setShowHistory(false);
    setSugg([]);
    setActiveIndex(-1);
    setIsFetching(false);
  }

  // Cerrar al clic fuera — limpiar para evitar reaparición en siguiente foco
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function saveToHistory(q: string) {
    if (!q || q.trim().length < 3) return;
    setRecent(prev => {
      const updated = [q.trim(), ...prev.filter(r => r !== q.trim())].slice(0, HISTORY_MAX);
      try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }

  function selectHistory(term: string) {
    setQuery(term);
    closeDropdown();
    router.push(`/actividades?search=${encodeURIComponent(term.trim())}`);
  }

  // ── Autocompletado ────────────────────────────────────────────────────────

  function fetchSuggestions(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (fetchCtrlRef.current) fetchCtrlRef.current.abort();

    if (value.length < 3) {
      setSugg([]);
      setShowSugg(false);
      setIsFetching(false);
      if (recentSearches.length > 0) setShowHistory(true);
      return;
    }

    setShowHistory(false);

    const cached = cacheRef.current.get(value);
    if (cached) {
      setSugg(cached);
      setShowSugg(true);
      setIsFetching(false);
      setActiveIndex(cached.length > 0 ? 0 : -1);
      return;
    }

    setIsFetching(true);
    setShowSugg(false);

    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      fetchCtrlRef.current = ctrl;
      try {
        const res  = await fetch(
          `/api/activities/suggestions?q=${encodeURIComponent(value)}`,
          { signal: ctrl.signal },
        );
        const data = await res.json();
        const list: SuggestionItem[] = data.suggestions ?? [];

        cacheRef.current.set(value, list);
        if (cacheRef.current.size > CACHE_MAX) {
          const oldest = cacheRef.current.keys().next().value;
          if (oldest) cacheRef.current.delete(oldest);
        }

        setSugg(list);
        setShowSugg(true);
        setIsFetching(false);
        setActiveIndex(list.length > 0 ? 0 : -1);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setSugg([]);
        setShowSugg(false);
        setIsFetching(false);
      }
    }, 300);
  }

  function selectSuggestion(s: SuggestionItem) {
    closeDropdown();
    if (s.type === 'activity') {
      saveToHistory(query);
      router.push(activityPath(s.id, s.label));
    } else if (s.type === 'category') {
      router.push(`/actividades?categoryId=${s.id}`);
    } else if (s.type === 'city') {
      router.push(`/actividades?cityId=${s.id}`);
    }
  }

  function submitSearch(q: string) {
    if (isSubmitting) return;

    const trimmed = q.trim();
    if (!trimmed) {
      // 🚀 Fase 2: Ejecuta la query subyacente del Hint Rotativo
      setIsSubmitting(true);
      closeDropdown();
      router.push(currentHref);
      setTimeout(() => setIsSubmitting(false), 800);
      return;
    }

    setIsSubmitting(true);
    closeDropdown();
    saveToHistory(trimmed);
    trackEvent({
      type: "search_applied",
      metadata: { query: trimmed }
    });
    
    logger.info('Búsqueda ejecutada', { action: 'submit', result: 'success', query: trimmed })

    router.push(`/actividades?search=${encodeURIComponent(trimmed)}`);
    
    setTimeout(() => setIsSubmitting(false), 800);
  }

  function handleChange(value: string) {
    setQuery(value);
    fetchSuggestions(value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const visible = showSugg || showHistory || isFetching;

    if (e.key === 'ArrowDown') {
      if (!visible) return;
      e.preventDefault();
      const max = showSugg ? suggestions.length - 1 : showHistory ? recentSearches.length - 1 : -1;
      setActiveIndex(i => Math.min(i + 1, max));
    } else if (e.key === 'ArrowUp') {
      if (!visible) return;
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showSugg && activeIndex >= 0 && suggestions[activeIndex]) {
        selectSuggestion(suggestions[activeIndex]);
      } else if (showHistory && activeIndex >= 0 && recentSearches[activeIndex]) {
        selectHistory(recentSearches[activeIndex]);
      } else {
        submitSearch(query);
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  }

  const dropdownVisible = showSugg || showHistory || isFetching;

  // 🚀 Iconografía dinámica
  let searchIcon;
  if (isFetching || isSubmitting) {
    searchIcon = (
      <svg className="w-5 h-5 animate-spin text-[var(--hp-text-muted)]" fill="none" viewBox="0 0 24 24" aria-hidden>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    );
  } else if (query.length > 0) {
    searchIcon = (
      <svg className="w-5 h-5 text-[var(--hp-text-muted)] cursor-pointer hover:text-brand-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="Limpiar" onClick={(e) => { e.stopPropagation(); setQuery(''); closeDropdown(); fetchSuggestions(''); }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  } else {
    searchIcon = (
      <svg className="w-5 h-5 text-[var(--hp-text-muted)] hover:text-brand-500 transition-colors cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden onClick={() => submitSearch('')}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
      </svg>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">

      {/* ── Input + dropdown ───────────────────────────────────────────── */}
      <div className="relative" ref={containerRef}>
        <Input
          id="hero-search"
          label="Buscar actividades"
          hideLabel
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => {
            if (query.length < 3) {
              if (recentSearches.length > 0) setShowHistory(true);
            } else if (suggestions.length > 0) {
              setShowSugg(true);
            } else if (!isFetching) {
              fetchSuggestions(query);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={query ? "" : hintText}
          autoComplete="off"
          spellCheck={false}
          disabled={isSubmitting}
          aria-autocomplete="list"
          aria-expanded={dropdownVisible}
          className="rounded-2xl shadow-lg py-4 text-base md:text-lg md:py-5 bg-[var(--hp-bg-elevated)] border border-[var(--hp-border-subtle)] focus:ring-2 focus:ring-brand-500 focus:border-brand-500 cursor-text"
          rightSlot={
            <div className="p-1 pr-1 mr-1">
               {searchIcon}
            </div>
          }
        />

        {/* Dropdown */}
        {dropdownVisible && (
          <div
            role="listbox"
            onMouseDown={e => e.preventDefault()}
            className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-[var(--hp-border-subtle)] bg-[var(--hp-bg-elevated)] shadow-xl overflow-hidden"
          >

            {/* Historial */}
            {showHistory && recentSearches.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-[var(--hp-text-muted)] uppercase tracking-wide select-none">
                  Búsquedas recientes
                </p>
                <ul>
                  {recentSearches.map((term, i) => (
                    <li
                      key={term}
                      onMouseEnter={() => setActiveIndex(i)}
                      onMouseLeave={() => setActiveIndex(-1)}
                      onClick={() => selectHistory(term)}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                        i === activeIndex ? 'bg-brand-50 text-[var(--hp-text-primary)]' : 'text-[var(--hp-text-primary)] hover:bg-[var(--hp-bg-page)]'
                      }`}
                    >
                      <svg className="w-4 h-4 shrink-0 text-[var(--hp-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="flex-1 truncate">{term}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Skeleton */}
            {isFetching && (
              <ul className="animate-pulse divide-y divide-gray-50 dark:divide-gray-800">
                {[1, 2, 3].map(i => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-gray-100 dark:bg-gray-700 rounded-full" style={{ width: `${50 + i * 15}%` }} />
                      <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full w-1/4" />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Sin resultados */}
            {!isFetching && showSugg && suggestions.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-[var(--hp-text-secondary)]">
                  No encontramos resultados para{' '}
                  <span className="font-medium text-[var(--hp-text-primary)]">&quot;{query}&quot;</span>
                </p>
              </div>
            )}

            {/* Resultados mixtos */}
            {!isFetching && showSugg && suggestions.length > 0 && (
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
                    <span className="text-base w-5 text-center shrink-0 select-none">
                      <SuggIcon type={s.type} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block truncate font-medium ${
                        i === activeIndex ? 'text-[var(--hp-text-primary)]' : 'text-[var(--hp-text-primary)]'
                      }`}>
                        {highlightMatch(s.label, query)}
                      </span>
                      {s.sublabel && (
                        <span className="text-xs text-[var(--hp-text-muted)] truncate block mt-0.5">{s.sublabel}</span>
                      )}
                    </span>
                    {s.type !== 'activity' && (
                      <span className={`shrink-0 text-xs rounded-full px-2 py-0.5 font-medium ${
                        s.type === 'category'
                          ? 'bg-violet-50 text-violet-600 dark:bg-violet-900 dark:text-violet-200'
                          : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-200'
                      }`}>
                        {s.type === 'category' ? 'Categoría' : 'Ciudad'}
                      </span>
                    )}
                    <span className={`shrink-0 text-xs ${
                      i === activeIndex ? 'text-brand-400' : 'text-[var(--hp-text-muted)]'
                    }`}>→</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Footer teclado — solo desktop */}
            {showSugg && suggestions.length > 0 && (
              <div className="hidden sm:block px-4 py-2 text-xs text-[var(--hp-text-muted)] border-t border-[var(--hp-border-subtle)] select-none">
                ↑↓ navegar · Enter seleccionar · Esc cerrar
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Chips rápidos ─────────────────────────────────────────────── */}
      <div className="flex gap-2.5 justify-center mt-4 flex-wrap">
        {QUICK_CHIPS.map(chip => (
          <Button
            key={chip.label}
            variant="ghost"
            size="sm"
            disabled={isSubmitting}
            onClick={() => router.push(chip.href)}
            className="rounded-full border border-[var(--hp-border-subtle)] bg-[var(--hp-bg-elevated)] focus:bg-[var(--hp-bg-subtle)] hover:bg-[var(--hp-bg-subtle)] hover:border-brand-400 hover:text-brand-600 shadow-sm font-medium transition-all"
          >
            {chip.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
