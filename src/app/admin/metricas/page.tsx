// =============================================================================
// /admin/metricas — Panel de métricas de HabitaPlan
// =============================================================================

import { requireRole } from '@/lib/auth';
import { UserRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const DAYS = 30;
const since = () => new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

export default async function MetricasPage() {
  await requireRole([UserRole.ADMIN]);

  const now   = new Date();
  const d30   = since();
  const d7    = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ── Queries en paralelo ──────────────────────────────────────────────────
  const [
    totalActivities,
    activeActivities,
    expiredActivities,
    totalUsers,
    totalProviders,

    viewsToday,
    viewsWeek,
    viewsMonth,

    topActivities,
    topSearches,
    zeroResultSearches,

    activitiesByType,
    activitiesByProvider,
  ] = await Promise.all([
    // Totales generales
    prisma.activity.count(),
    prisma.activity.count({ where: { status: 'ACTIVE' } }),
    prisma.activity.count({ where: { status: 'EXPIRED' } }),
    prisma.user.count(),
    prisma.provider.count(),

    // Vistas por período
    prisma.activityView.count({ where: { viewedAt: { gte: today } } }),
    prisma.activityView.count({ where: { viewedAt: { gte: d7 } } }),
    prisma.activityView.count({ where: { viewedAt: { gte: d30 } } }),

    // Top 10 actividades más vistas (últimos 30 días)
    prisma.activityView.groupBy({
      by:      ['activityId'],
      where:   { viewedAt: { gte: d30 } },
      _count:  { activityId: true },
      orderBy: { _count: { activityId: 'desc' } },
      take:    10,
    }),

    // Top 20 búsquedas más frecuentes (últimos 30 días)
    prisma.searchLog.groupBy({
      by:      ['query'],
      where:   { searchedAt: { gte: d30 } },
      _count:  { query: true },
      orderBy: { _count: { query: 'desc' } },
      take:    20,
    }),

    // Búsquedas sin resultados (últimos 30 días)
    prisma.searchLog.groupBy({
      by:      ['query'],
      where:   { searchedAt: { gte: d30 }, resultCount: 0 },
      _count:  { query: true },
      orderBy: { _count: { query: 'desc' } },
      take:    10,
    }),

    // Distribución por tipo
    prisma.activity.groupBy({
      by:      ['type'],
      where:   { status: { in: ['ACTIVE', 'EXPIRED'] } },
      _count:  { type: true },
      orderBy: { _count: { type: 'desc' } },
    }),

    // Top 5 proveedores por actividades
    prisma.activity.groupBy({
      by:      ['providerId'],
      where:   { status: { in: ['ACTIVE', 'EXPIRED'] } },
      _count:  { providerId: true },
      orderBy: { _count: { providerId: 'desc' } },
      take:    5,
    }),
  ]);

  // Resolver nombres de actividades para el ranking de vistas
  const activityIds = topActivities.map((r) => r.activityId);
  const activityNames = activityIds.length
    ? await prisma.activity.findMany({
        where:  { id: { in: activityIds } },
        select: { id: true, title: true, status: true },
      })
    : [];
  const nameMap = Object.fromEntries(activityNames.map((a) => [a.id, a]));

  // Resolver nombres de proveedores
  const providerIds = activitiesByProvider.map((r) => r.providerId);
  const providerNames = providerIds.length
    ? await prisma.provider.findMany({
        where:  { id: { in: providerIds } },
        select: { id: true, name: true },
      })
    : [];
  const providerMap = Object.fromEntries(providerNames.map((p) => [p.id, p.name]));

  const TYPE_LABELS: Record<string, string> = {
    ONE_TIME: 'Única vez', RECURRING: 'Recurrente', WORKSHOP: 'Taller', CAMP: 'Campamento',
  };

  const maxTypeCount = Math.max(...activitiesByType.map((t) => t._count.type ?? 0), 1);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin" className="hover:text-gray-700">Admin</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Métricas</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">📊 Panel de métricas</h1>

      {/* ── STATS GENERALES ──────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Resumen general</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Total actividades" value={totalActivities} />
          <StatCard label="Activas"           value={activeActivities}  color="text-emerald-600" />
          <StatCard label="Expiradas"         value={expiredActivities} color="text-warning-600" />
          <StatCard label="Usuarios"          value={totalUsers} />
          <StatCard label="Proveedores"       value={totalProviders} />
        </div>
      </section>

      {/* ── VISTAS ───────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Vistas de actividades</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Hoy"         value={viewsToday} />
          <StatCard label="Últimos 7 días"  value={viewsWeek} />
          <StatCard label="Últimos 30 días" value={viewsMonth} />
        </div>
      </section>

      {/* ── TOP ACTIVIDADES ──────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Actividades más vistas — últimos 30 días</SectionTitle>
        {topActivities.length === 0 ? (
          <EmptyMsg>Aún no hay vistas registradas.</EmptyMsg>
        ) : (
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Actividad</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Estado</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Vistas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topActivities.map((row, i) => {
                  const act = nameMap[row.activityId];
                  return (
                    <tr key={row.activityId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                        {act ? (
                          <Link
                            href={`/admin/actividades/${act.id}/editar`}
                            className="hover:text-indigo-600 transition-colors"
                          >
                            {act.title}
                          </Link>
                        ) : (
                          <span className="text-gray-400 italic">Actividad eliminada</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {act && (
                          <StatusBadge status={act.status} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-indigo-600">
                        {(row._count.activityId ?? 0).toLocaleString('es-CO')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── BÚSQUEDAS FRECUENTES ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

        <section>
          <SectionTitle>Búsquedas más frecuentes — 30 días</SectionTitle>
          {topSearches.length === 0 ? (
            <EmptyMsg>Aún no hay búsquedas registradas.</EmptyMsg>
          ) : (
            <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
              <ul className="divide-y divide-gray-100">
                {topSearches.map((row, i) => (
                  <li
                    key={row.query}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 font-mono w-5">{i + 1}</span>
                      <Link
                        href={`/actividades?search=${encodeURIComponent(row.query)}`}
                        className="text-sm font-medium text-gray-800 hover:text-indigo-600 transition-colors"
                        target="_blank"
                      >
                        {row.query}
                      </Link>
                    </div>
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                      {row._count.query ?? 0}×
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section>
          <SectionTitle>Sin resultados — 30 días</SectionTitle>
          {zeroResultSearches.length === 0 ? (
            <EmptyMsg>¡Todas las búsquedas encontraron resultados!</EmptyMsg>
          ) : (
            <div className="rounded-2xl border border-error-100 overflow-hidden bg-white">
              <ul className="divide-y divide-gray-100">
                {zeroResultSearches.map((row, i) => (
                  <li
                    key={row.query}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-red-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 font-mono w-5">{i + 1}</span>
                      <span className="text-sm font-medium text-gray-800">{row.query}</span>
                    </div>
                    <span className="text-xs font-semibold text-error-500 bg-error-50 rounded-full px-2 py-0.5">
                      {row._count.query ?? 0}×
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* ── DISTRIBUCIÓN POR TIPO ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

        <section>
          <SectionTitle>Por tipo de actividad</SectionTitle>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
            {activitiesByType.map((row) => (
              <div key={row.type}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">
                    {TYPE_LABELS[row.type] ?? row.type}
                  </span>
                  <span className="text-gray-500">{row._count.type ?? 0}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${((row._count.type ?? 0) / maxTypeCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle>Top proveedores</SectionTitle>
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
            <ul className="divide-y divide-gray-100">
              {activitiesByProvider.map((row, i) => (
                <li
                  key={row.providerId}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 font-mono w-5">{i + 1}</span>
                    <span className="text-sm font-medium text-gray-800">
                      {providerMap[row.providerId] ?? 'Desconocido'}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-600">
                    {row._count.providerId ?? 0} actividades
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

    </div>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-gray-500 tracking-wide mb-3">
      {children}
    </h2>
  );
}

function StatCard({
  label, value, color = 'text-gray-900',
}: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center">
      <p className={`text-2xl font-bold tabular-nums ${color}`}>
        {value.toLocaleString('es-CO')}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    ACTIVE:  'bg-emerald-100 text-emerald-700',
    EXPIRED: 'bg-warning-100 text-warning-700',
    DRAFT:   'bg-gray-100 text-gray-600',
    PAUSED:  'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg[status] ?? cfg.DRAFT}`}>
      {status}
    </span>
  );
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-400">
      {children}
    </div>
  );
}
