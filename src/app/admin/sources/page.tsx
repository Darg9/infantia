import { requireRole } from '@/lib/auth';
import { UserRole } from '@/generated/prisma/client';
import Link from 'next/link';
import { SourceStatsTable } from './components/SourceStatsTable';

export default async function SourcesStatsPage() {
  await requireRole([UserRole.ADMIN]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link href="/admin" className="text-sm text-brand-600 hover:underline mb-2 inline-block">
          &larr; Panel admin
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">URL Score Dashboard</h1>
        <p className="text-gray-500 text-sm mt-2">
          Monitoreo automático de calidad de URLs y pausa de fuentes de bajo desempeño
        </p>
      </div>

      {/* Source Stats Table */}
      <SourceStatsTable />
    </div>
  );
}
