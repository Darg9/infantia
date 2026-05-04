// =============================================================================
// /perfil/favoritos — Lista de actividades y lugares favoritos del usuario
// Server Component — usa select explícito para evitar Decimal no serializable
// =============================================================================

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth, getOrCreateDbUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import ActivityCard from '@/app/actividades/_components/ActivityCard';
import { FavoriteButton } from '@/components/FavoriteButton';

export const metadata: Metadata = {
  title: 'Favoritos | HabitaPlan',
  description: 'Tus actividades guardadas en HabitaPlan',
};

export default async function FavoritosPage() {
  const user = await requireAuth();
  const dbUser = await getOrCreateDbUser(user);

  // ── Select explícito — NO incluir Decimal (latitude/longitude, price).
  // Decimal es un tipo de clase de Prisma; Next.js no puede serializar clases
  // al cruzar la frontera Server→Client. Seleccionamos solo campos primitivos.
  const favorites = await prisma.favorite.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      // ── Actividad favorita ──
      activity: {
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          status: true,
          audience: true,
          ageMin: true,
          ageMax: true,
          // price es Decimal → convertimos a number en el map
          price: true,
          priceCurrency: true,
          pricePeriod: true,
          imageUrl: true,
          sourceUrl: true,
          sourceDomain: true,
          duplicatesCount: true,
          createdAt: true,
          provider: {
            select: { name: true, isVerified: true, isPremium: true },
          },
          location: {
            select: {
              name: true,
              neighborhood: true,
              city: { select: { name: true } },
            },
          },
          categories: {
            select: { category: { select: { id: true, name: true, slug: true } } },
          },
          // _count NO se puede usar en select anidado en Prisma 7;
          // se omite y se defaultea a 0 en el mapper (campo opcional en ActivityCard)
        },
      },
      // ── Lugar favorito ──
      location: {
        select: {
          id: true,
          name: true,
          address: true,
          neighborhood: true,
          // latitude y longitude son Decimal → NO seleccionamos para evitar crash
          city: { select: { name: true } },
        },
      },
    },
  });

  // ── Normalizar datos a objetos planos serializables ──────────────────────
  type ActivityFav = {
    type: 'activity';
    favId: string;
    item: {
      id: string;
      title: string;
      description: string;
      type: string;
      status: string;
      audience: string;
      ageMin: number | null;
      ageMax: number | null;
      price: number | null;
      priceCurrency: string;
      pricePeriod: string | null;
      imageUrl: string | null;
      sourceUrl: string | null;
      sourceDomain: string | null;
      duplicatesCount: number;
      createdAt: string; // ISO string — Date no es serializable
      provider: { name: string; isVerified: boolean; isPremium: boolean } | null;
      location: { name: string; neighborhood: string | null; city: { name: string } | null } | null;
      categories: { category: { id: string; name: string; slug: string } }[];
      _count: { views: number };
    };
  };

  type PlaceFav = {
    type: 'place';
    favId: string;
    item: {
      id: string;
      name: string;
      address: string;
      neighborhood: string | null;
      city: { name: string } | null;
    };
  };

  const mixedFavorites: (ActivityFav | PlaceFav)[] = [];

  for (const f of favorites) {
    if (f.activity) {
      const act = f.activity;
      mixedFavorites.push({
        type: 'activity',
        favId: f.id,
        item: {
          id: act.id,
          title: act.title,
          description: act.description,
          type: act.type,
          status: act.status,
          audience: act.audience,
          ageMin: act.ageMin,
          ageMax: act.ageMax,
          // Convertir Decimal a number explícitamente
          price: act.price !== null && act.price !== undefined
            ? (typeof (act.price as any).toNumber === 'function'
                ? (act.price as any).toNumber()
                : Number(act.price))
            : null,
          priceCurrency: act.priceCurrency,
          pricePeriod: act.pricePeriod,
          imageUrl: act.imageUrl,
          sourceUrl: act.sourceUrl,
          sourceDomain: act.sourceDomain,
          duplicatesCount: act.duplicatesCount,
          // Convertir Date a ISO string
          createdAt: act.createdAt instanceof Date
            ? act.createdAt.toISOString()
            : String(act.createdAt),
          provider: act.provider,
          location: act.location,
          categories: act.categories,
          _count: { views: 0 },
        },
      });
    } else if (f.location) {
      mixedFavorites.push({
        type: 'place',
        favId: f.id,
        item: {
          id: f.location.id,
          name: f.location.name,
          address: f.location.address,
          neighborhood: f.location.neighborhood,
          city: f.location.city,
        },
      });
    }
  }

  const activeCount = mixedFavorites.filter(
    (f) => f.type === 'activity' && f.item.status === 'ACTIVE'
  ).length;
  const expiredCount = mixedFavorites.filter(
    (f) => f.type === 'activity' && f.item.status === 'EXPIRED'
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[var(--hp-text-primary)]">Favoritos</h1>
        {mixedFavorites.length > 0 && (
          <span className="rounded-full bg-error-100 px-2.5 py-0.5 text-xs font-semibold text-error-700">
            {mixedFavorites.length}
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
      {/* Grid o empty state */}
      {mixedFavorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-6 text-center px-4">
          <div className="space-y-1.5 max-w-[320px]">
            <p className="text-lg font-bold text-[var(--hp-text-primary)] dark:text-white leading-snug">
              Guarda lo que te guste <br/> y encuéntralo fácilmente después
            </p>
            <p className="text-sm text-[var(--hp-text-secondary)] dark:text-[var(--hp-text-muted)]">
              Toca el corazón para guardar lo que te guste
            </p>
          </div>

          <div className='w-full max-w-[260px] rounded-2xl border border-[var(--hp-border)] border-[var(--hp-border-subtle)] bg-[var(--hp-bg-surface)] shadow-[var(--hp-shadow-md)] overflow-hidden select-none'>
            <div className='aspect-[4/3] bg-[var(--hp-bg-page)] bg-[var(--hp-bg-surface)] relative' aria-hidden="true">
              <div
                role="button"
                tabIndex={0}
                aria-label="Guardar"
                className='absolute top-3 right-3 bg-white/90 bg-[var(--hp-bg-surface)]/90 backdrop-blur-sm shadow-[var(--hp-shadow-md)] rounded-full p-2 cursor-pointer hover:scale-110 transition-transform duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2'
              >
                <svg className="w-5 h-5 text-error-500 hover:text-error-600 fill-current transition-colors" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-2.5">
              <div className='h-5 bg-[var(--hp-bg-surface)] rounded w-3/4'></div>
              <div className='h-3 bg-[var(--hp-bg-page)] bg-[var(--hp-bg-surface)] rounded w-1/2'></div>
            </div>
          </div>

          <Link
            href="/actividades"
            className="mt-2 inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 active:bg-brand-700 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 w-full sm:w-auto"
          >
            Ver actividades
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mixedFavorites.map((fav) => {
            if (fav.type === 'activity') {
              return (
                <div key={fav.favId} className="relative group">
                  {/* fav.item ya es un objeto plano con price=number y createdAt=string */}
                  <ActivityCard activity={fav.item as any} isFavorited={true} />
                </div>
              );
            } else {
              const loc = fav.item;
              return (
                <div key={fav.favId} className='relative group flex flex-col rounded-2xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] shadow-[var(--hp-shadow-md)] transition-all duration-200 hover:shadow-[var(--hp-shadow-md)] hover:-translate-y-0.5 overflow-hidden h-full min-h-[280px]'>
                  <div className='absolute z-10 top-2.5 left-2.5 px-2 py-0.5 bg-success-600 text-white text-xs font-medium rounded-full shadow-[var(--hp-shadow-md)] border border-success-500/50 pointer-events-none tracking-wide'>
                    Lugar
                  </div>
                  <div className="h-24 bg-gradient-to-br from-success-100 to-success-200 flex items-center justify-center">
                    <span className="text-4xl">🏛️</span>
                  </div>
                  <div className="flex flex-col p-4 flex-1">
                    <h3 className="text-base font-bold text-[var(--hp-text-primary)] line-clamp-2 leading-snug">{loc.name}</h3>
                    <p className="text-xs text-[var(--hp-text-secondary)] mt-2 line-clamp-2">{loc.address}</p>
                    <div className="flex items-center mt-auto pt-3 border-t border-[var(--hp-border)] justify-between">
                      <span className="flex items-center gap-1 text-xs text-[var(--hp-text-secondary)]">
                        <span>📍</span> {loc.neighborhood || loc.city?.name || 'Ciudad'}
                      </span>
                      <FavoriteButton
                        targetId={loc.id}
                        targetType="place"
                        initialIsFavorited={true}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
