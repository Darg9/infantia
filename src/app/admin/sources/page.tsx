import { requireRole } from '@/lib/auth';
import { UserRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { SourceStatsTable } from './components/SourceStatsTable';
import { SourcesManager } from './components/SourcesManager';

export default async function SourcesStatsPage() {
  await requireRole([UserRole.ADMIN]);

  const [cities, verticals] = await Promise.all([
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.vertical.findMany({
      where: { isActive: true },
      select: { id: true, slug: true },
      orderBy: { slug: 'asc' },
    }),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      <div className="mb-8">
        <Link href="/admin" className="text-sm text-brand-600 hover:underline mb-2 inline-block">
          &larr; Panel admin
        </Link>
        <h1 className="text-3xl font-bold text-[var(--hp-text-primary)]">Fuentes de scraping</h1>
        <p className="text-[var(--hp-text-secondary)] text-sm mt-2">
          Gestión de fuentes activas y monitoreo de calidad de URLs
        </p>
      </div>

      {/* CRUD de fuentes */}
      <section>
        <h2 className="text-xl font-semibold text-[var(--hp-text-primary)] mb-4">Administrar fuentes</h2>
        <SourcesManager cities={cities} verticals={verticals} />
      </section>

      {/* URL Score Dashboard */}
      <section>
        <h2 className="text-xl font-semibold text-[var(--hp-text-primary)] mb-4">URL Score Dashboard</h2>
        <p className="text-[var(--hp-text-secondary)] text-sm mb-4">
          Monitoreo automático de calidad de URLs y pausa de fuentes de bajo desempeño
        </p>
        <SourceStatsTable />
      </section>
    </div>
  );
}
