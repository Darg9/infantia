'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function PerfilError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log del error para debugging en producción
    console.error('[Perfil Error]', error.message, error.digest);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center gap-6">
      <span className="text-5xl">😕</span>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-xl font-bold text-[var(--hp-text-primary)]">
          Algo salió mal
        </h2>
        <p className="text-sm text-[var(--hp-text-secondary)]">
          No pudimos cargar esta sección de tu perfil. Puede ser un error temporal.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
        >
          Intentar de nuevo
        </button>
        <Link
          href="/perfil"
          className="px-4 py-2 rounded-xl border border-[var(--hp-border)] text-[var(--hp-text-secondary)] text-sm font-medium hover:bg-[var(--hp-bg-subtle)] transition-colors"
        >
          Volver al perfil
        </Link>
      </div>
    </div>
  );
}
