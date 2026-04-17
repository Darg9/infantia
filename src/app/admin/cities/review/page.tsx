// =============================================================================
// /admin/cities/review — Revisión humana de ciudades con baja confianza
// Solo accesible por ADMIN (requireRole + middleware /api/admin/*)
// =============================================================================

import { requireRole } from '@/lib/auth';
import { UserRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { CityReviewClient } from './CityReviewClient';

export const metadata = {
  title: 'Revisión de ciudades — HabitaPlan Admin',
};

export default async function CityReviewPage() {
  await requireRole([UserRole.ADMIN]);

  // Todas las ciudades activas para el dropdown de reasignación
  const cities = await prisma.city.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-sm text-brand-600 hover:underline mb-2 inline-block"
        >
          &larr; Panel admin
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          Revisión de ciudades
        </h1>
        <p className="text-gray-500 text-sm mt-2">
          Entradas con baja confianza de matching canónico (score &lt; 0.9).
          Aprueba la sugerencia, reasigna a otra ciudad, o ignora la entrada.
        </p>
      </div>

      {/* Leyenda de scores */}
      <div className="flex items-center gap-4 mb-6 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-success-400" />
          ≥ 90% — Alta confianza
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-warning-400" />
          75–89% — Requiere revisión
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-error-400" />
          &lt; 75% — Desconocida
        </span>
      </div>

      <CityReviewClient cities={cities} />
    </div>
  );
}
