// =============================================================================
// /perfil/favoritos — Lista de actividades favoritas del usuario autenticado
// Server Component
// =============================================================================

import type { Metadata } from 'next';
import { requireAuth, getOrCreateDbUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import ActivityCard from '@/app/actividades/_components/ActivityCard';

export const metadata: Metadata = {
  title: 'Mis favoritos | Infantia',
  description: 'Tus actividades guardadas en Infantia',
};

export default async function FavoritosPage() {
  const user = await requireAuth();

  const dbUser = await getOrCreateDbUser(user);

  const favorites = await prisma.favorite.findMany({
    where: { userId: dbUser.id },
    orderBy: [{ activity: { status: 'asc' } }, { createdAt: 'desc' }],
    include: {
      activity: {
        include: {
          provider: { select: { name: true, isVerified: true } },
          location: {
            select: {
              name: true,
              neighborhood: true,
              city: { select: { name: true } },
            },
          },
          categories: {
            include: { category: { select: { id: true, name: true, slug: true } } },
          },
        },
      },
    },
  });

  const activities = favorites.map((f) => f.activity);
  const activeCount = activities.filter((a) => a.status === 'ACTIVE').length;
  const expiredCount = activities.filter((a) => a.status === 'EXPIRED').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Mis favoritos</h1>
        {activities.length > 0 && (
          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
            {activities.length}
          </span>
        )}
      </div>

      {/* Aviso si hay expiradas */}
      {expiredCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {expiredCount === 1
            ? '1 actividad puede haber expirado o cambiado. Aparece al final.'
            : `${expiredCount} actividades pueden haber expirado o cambiado. Aparecen al final.`}
        </div>
      )}

      {/* Grid or empty state */}
      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <span className="text-6xl">🤍</span>
          <p className="text-gray-600 font-medium text-lg">Aún no tienes favoritos</p>
          <p className="text-sm text-gray-400 max-w-sm">
            Toca el corazón en cualquier actividad para guardarla aquí y encontrarla fácilmente después.
          </p>
          <a
            href="/actividades"
            className="mt-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Explorar actividades
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              isFavorited={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
