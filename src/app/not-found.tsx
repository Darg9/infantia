// =============================================================================
// not-found.tsx — Página 404 personalizada
// Next.js muestra este componente para cualquier ruta no encontrada
// =============================================================================

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 — Página no encontrada | HabitaPlan',
};

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[var(--hp-bg-page)] flex items-center justify-center px-4">
      <div className="flex flex-col items-center text-center gap-6 max-w-md">

        {/* Ilustración */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-8xl select-none">🗺️</span>
          <div className="flex flex-col gap-1">
            <span className="text-6xl font-extrabold text-gray-200 leading-none">404</span>
          </div>
        </div>

        {/* Texto */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-[var(--hp-text-primary)]">
            Esta página no existe
          </h1>
          <p className="text-[var(--hp-text-secondary)] text-sm leading-relaxed">
            La dirección que buscas no existe o fue movida.
            Puede que la actividad haya sido removida o el enlace esté desactualizado.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <a
            href="/actividades"
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors text-center"
          >
            Ver actividades
          </a>
          <a
            href="/"
            className="rounded-xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] px-6 py-2.5 text-sm font-semibold text-[var(--hp-text-primary)] hover:bg-[var(--hp-bg-page)] transition-colors text-center"
          >
            Ir al inicio
          </a>
        </div>

      </div>
    </div>
  );
}
