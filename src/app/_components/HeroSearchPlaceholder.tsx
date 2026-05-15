// =============================================================================
// HeroSearchPlaceholder — Fachada estática del hero search (cero JS)
//
// Replica el DOM visual exacto que produce <HeroSearch unified /> usando el
// mismo árbol que el componente Input renderiza:
//   <div.space-y-1.5>
//     <label.sr-only>
//     <div.relative>
//       <input ...clases unificadas... />
//       <div.absolute.right-3 → rightSlot>
//
// Propósito: cubrir la ventana FCP→TTI sin cargar el chunk HeroSearch.
// Cuando el usuario interactúa, HeroSearchLoader hace el swap a HeroSearch.
// =============================================================================

export function HeroSearchPlaceholder({ unified = false }: { unified?: boolean }) {
  return (
    <form action="/actividades" method="GET" className="w-full max-w-2xl mx-auto">
      <div className="space-y-1.5">
        <label htmlFor="hp-search-ph" className="sr-only">
          Buscar actividades
        </label>
        <div className="relative">
          <input
            id="hp-search-ph"
            name="search"
            type="text"
            placeholder="Busca talleres, clubes, eventos..."
            autoComplete="off"
            spellCheck={false}
            className={
              unified
                ? // Clases base Input + overrides unified (igual que HeroSearch)
                  'w-full text-base md:text-lg bg-transparent text-[var(--hp-text-primary)] placeholder:text-[var(--hp-text-secondary)] transition-colors focus:outline-none focus:ring-0 rounded-none shadow-none border-0 py-4 md:py-5 cursor-text pl-3.5 pr-10'
                : 'w-full text-sm bg-[var(--hp-bg-elevated)] text-[var(--hp-text-primary)] placeholder:text-[var(--hp-text-secondary)] border border-[var(--hp-border-subtle)] rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--hp-action-primary)] focus:border-[var(--hp-action-primary)] shadow-[var(--hp-shadow-md)] pl-3.5 pr-10 py-4 md:py-5 cursor-text'
            }
          />
          {/* rightSlot — mismo posicionamiento que Input.rightSlot */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="p-1 pr-1 mr-1">
              <button type="submit" aria-label="Buscar" className="flex items-center">
                <svg
                  className="w-5 h-5 text-[var(--hp-text-muted)] hover:text-brand-500 transition-colors cursor-pointer"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
