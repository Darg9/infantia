// =============================================================================
// /admin/preflight — Análisis de calidad del Date Preflight
// Solo accesible por ADMIN
// =============================================================================

import { requireRole } from '@/lib/auth';
import { UserRole } from '@/generated/prisma/client';
import Link from 'next/link';
import { PreflightClient } from './PreflightClient';

export const metadata = {
  title: 'Date Preflight — HabitaPlan Admin',
};

export default async function PreflightPage() {
  await requireRole([UserRole.ADMIN]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-sm text-brand-600 hover:underline mb-2 inline-block"
        >
          &larr; Panel admin
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Date Preflight</h1>
        <p className="text-gray-500 text-sm mt-2">
          Análisis de filtrado previo a Gemini. Detecta over/under-filtering y fallos de parsing
          por rango de fechas.
        </p>
      </div>

      {/* Leyenda de razones */}
      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { label: 'Procesada → Gemini', cls: 'bg-success-100 text-success-700' },
          { label: 'Pasada (datetime)', cls: 'bg-warning-100 text-warning-700' },
          { label: 'Pasada (texto/año/keyword)', cls: 'bg-orange-100 text-orange-700' },
        ].map(({ label, cls }) => (
          <span
            key={label}
            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}
          >
            {label}
          </span>
        ))}
        <span className="text-xs text-gray-400 self-center">
          · TTL recomendado: 14 días
        </span>
      </div>

      <PreflightClient />
    </div>
  );
}
