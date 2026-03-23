import type { Metadata } from 'next'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { StarRating } from '@/components/StarRating'

export const metadata: Metadata = {
  title: 'Mis calificaciones | Infantia',
}

export default async function CalificacionesPage() {
  const user = await requireAuth()

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    select: { id: true },
  })

  if (!dbUser) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-gray-500">Usuario no encontrado.</p>
      </div>
    )
  }

  const ratings = await prisma.rating.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: 'desc' },
    include: {
      activity: {
        select: { id: true, title: true, imageUrl: true },
      },
    },
  })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mis calificaciones</h1>
        {ratings.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            {ratings.length}
          </span>
        )}
      </div>

      {ratings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <span className="text-6xl">⭐</span>
          <p className="text-gray-600 font-medium text-lg">Aun no has calificado actividades</p>
          <p className="text-sm text-gray-400 max-w-sm">
            Visita una actividad y dejale una calificacion para ayudar a otros padres.
          </p>
          <Link
            href="/actividades"
            className="mt-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Explorar actividades
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {ratings.map((rating) => (
            <Link
              key={rating.id}
              href={`/actividades/${rating.activity.id}`}
              className="flex items-start gap-4 bg-white border border-gray-200 rounded-2xl p-4 hover:border-orange-300 transition-colors group"
            >
              {/* Image or placeholder */}
              {rating.activity.imageUrl ? (
                <img
                  src={rating.activity.imageUrl}
                  alt=""
                  className="w-16 h-16 rounded-xl object-cover shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-amber-50 flex items-center justify-center text-2xl shrink-0">
                  ⭐
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 group-hover:text-orange-600 transition-colors truncate">
                  {rating.activity.title}
                </p>
                <div className="mt-1">
                  <StarRating value={rating.score} readonly size="sm" />
                </div>
                {rating.comment && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{rating.comment}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(rating.createdAt).toLocaleDateString('es-CO', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
