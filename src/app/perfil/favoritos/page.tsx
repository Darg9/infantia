// =============================================================================
// /perfil/favoritos — Lista de actividades favoritas del usuario autenticado
// Server Component
// =============================================================================

import type { Metadata } from 'next';
import { requireAuth, getOrCreateDbUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import ActivityCard from '@/app/actividades/_components/ActivityCard';

export const metadata: Metadata = {
  title: 'Favoritos | HabitaPlan',
  description: 'Tus actividades guardadas en HabitaPlan',
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
          provider: { select: { name: true, isVerified: true, isPremium: true } },
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
        <h1 className="text-2xl font-bold text-gray-900">Favoritos</h1>
        {activities.length > 0 && (
          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
            {activities.length}
          </span>
        )}
      </div>

      {/* Aviso si hay expiradas */}
      {expiredCount > 0 && (
        <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          {expiredCount === 1
            ? '1 actividad puede haber expirado o cambiado. Aparece al final.'
            : `${expiredCount} actividades pueden haber expirado o cambiado. Aparecen al final.`}
        </div>
      )}

      {/* Grid or empty state */}
      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-6 text-center px-4">
          <div className="space-y-1.5 max-w-[320px]">
            <p className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
              Guarda lo que te guste <br/> y encuéntralo fácilmente después
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Toca el corazón para guardar lo que te guste
            </p>
          </div>

          <div className="w-full max-w-[260px] rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden select-none">
            <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800 relative" aria-hidden="true">
              <div 
                role="button"
                tabIndex={0}
                aria-label="Guardar"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') e.preventDefault()
                }}
                className="absolute top-3 right-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-sm rounded-full p-2 cursor-pointer hover:scale-110 transition-transform duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
              >
                <svg className="w-5 h-5 text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 fill-current transition-colors" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-2.5">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2"></div>
            </div>
          </div>

          <a
            href="/actividades"
            className="mt-2 inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 active:bg-brand-700 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 w-full sm:w-auto"
          >
            Ver actividades
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
