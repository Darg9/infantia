// =============================================================================
// /perfil/favoritos — Lista de actividades favoritas del usuario autenticado
// Server Component
// =============================================================================

import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import ActivityCard from '@/app/actividades/_components/ActivityCard';

export const metadata: Metadata = {
  title: 'Mis favoritos | Infantia',
  description: 'Tus actividades guardadas en Infantia',
};

export default async function FavoritosPage() {
  const user = await requireAuth();

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    select: { id: true },
  });

  if (!dbUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Usuario no encontrado.</p>
      </div>
    );
  }

  const favorites = await prisma.favorite.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: 'desc' },
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 flex flex-col gap-6">

        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <a
            href="/perfil"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Mi perfil
          </a>
          <span className="text-gray-300">/</span>
          <h1 className="text-2xl font-bold text-gray-900">Mis favoritos</h1>
          {activities.length > 0 && (
            <span className="ml-2 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
              {activities.length}
            </span>
          )}
        </div>

        {/* Grid o estado vacío */}
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
    </div>
  );
}
