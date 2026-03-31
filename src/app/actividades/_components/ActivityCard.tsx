// =============================================================================
// ActivityCard — tarjeta de actividad para el grid de /actividades
// =============================================================================

import clsx from 'clsx';
import { getCategoryGradient, getCategoryEmoji } from '@/lib/category-utils';
import { FavoriteButton } from '@/components/FavoriteButton';
import { activityPath } from '@/lib/activity-url';

// Tipo local inferido desde lo que devuelve listActivities
// Prisma retorna price como Decimal (objeto con toNumber()), no como number primitivo
type PrismaPrice = number | { toNumber(): number } | null;

interface Activity {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  audience: string;
  ageMin: number | null;
  ageMax: number | null;
  price: PrismaPrice;
  priceCurrency: string;
  pricePeriod: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  createdAt: Date;
  provider: { name: string; isVerified: boolean; isPremium: boolean } | null;
  location: {
    name: string;
    neighborhood: string | null;
    city: { name: string } | null;
  } | null;
  categories: { category: { id: string; name: string; slug: string } }[];
}

interface ActivityCardProps {
  activity: Activity;
  /** true si el usuario autenticado ya marcó esta actividad como favorita */
  isFavorited?: boolean;
}


function formatAge(ageMin: number | null, ageMax: number | null): string {
  if (ageMin === null && ageMax === null) return '';
  if (ageMin !== null && ageMax !== null) return `${ageMin}–${ageMax} años`;
  if (ageMin !== null) return `Desde ${ageMin} años`;
  return `Hasta ${ageMax} años`;
}

function formatPrice(price: PrismaPrice, currency: string, period: string | null): string {
  if (price === null) return 'No disponible';
  const numPrice = typeof price === 'number' ? price : price.toNumber();
  if (numPrice === 0 || period === 'FREE') return 'Gratis';
  const formatted = new Intl.NumberFormat('es-CO', { style: 'currency', currency, minimumFractionDigits: 0 }).format(numPrice);
  const periodLabel: Record<string, string> = {
    PER_SESSION: '/sesión',
    MONTHLY: '/mes',
    TOTAL: '',
    FREE: '',
  };
  return `${formatted}${period ? (periodLabel[period] ?? '') : ''}`;
}

const TYPE_LABELS: Record<string, string> = {
  RECURRING: 'Recurrente',
  ONE_TIME: 'Única vez',
  CAMP: 'Campamento',
  WORKSHOP: 'Taller',
};

const NEW_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 días en ms

export default function ActivityCard({ activity, isFavorited = false }: ActivityCardProps) {
  const mainCategory = activity.categories[0]?.category;
  const gradient = getCategoryGradient(mainCategory?.slug ?? '');
  const categoryEmoji = mainCategory ? getCategoryEmoji(mainCategory.name) : '✨';
  const ageLabel = formatAge(activity.ageMin, activity.ageMax);
  const priceLabel = formatPrice(activity.price, activity.priceCurrency, activity.pricePeriod);
  const locationLabel = activity.location?.neighborhood ?? activity.location?.city?.name ?? '';
  const isNew = activity.status !== 'EXPIRED'
    && Date.now() - new Date(activity.createdAt).getTime() < NEW_THRESHOLD_MS;

  const cardContent = (
    <div className="group flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden h-full">

      {/* Strip visual — siempre presente, h-20 */}
      <div
        className={clsx(
          'relative h-20 flex items-center justify-center overflow-hidden',
          activity.status === 'EXPIRED' && 'opacity-60'
        )}
        style={activity.imageUrl ? undefined : { background: gradient }}
      >
        {activity.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activity.imageUrl}
            alt={activity.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-4xl select-none drop-shadow-sm">{categoryEmoji}</span>
        )}

        {/* Badge tipo */}
        <span className="absolute top-1.5 left-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-700 shadow-sm">
          {TYPE_LABELS[activity.type] ?? activity.type}
        </span>

        {/* Badge precio — sólo cuando hay información */}
        {priceLabel !== 'No disponible' && (
          <span className={clsx(
            'absolute top-1.5 right-2 rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm',
            priceLabel === 'Gratis' ? 'bg-emerald-500 text-white' : 'bg-white/90 text-gray-700'
          )}>
            {priceLabel}
          </span>
        )}

        {/* Badge expirada */}
        {activity.status === 'EXPIRED' && (
          <span className="absolute bottom-1.5 left-0 right-0 mx-auto w-fit rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
            Verificar disponibilidad
          </span>
        )}

        {/* Badge Destacado — proveedor premium */}
        {activity.provider?.isPremium && (
          <span className="absolute bottom-1.5 left-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-900 shadow-sm">
            ⭐ Destacado
          </span>
        )}

        {/* Badge Nuevo — actividades de los últimos 7 días (solo si no es destacado) */}
        {isNew && !activity.provider?.isPremium && (
          <span className="absolute bottom-1.5 left-2 rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
            🆕 Nuevo
          </span>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-col gap-2 p-4 flex-1">

        {/* Categorías */}
        {activity.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {activity.categories.slice(0, 2).map(({ category }) => (
              <span
                key={category.id}
                className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
              >
                {category.name}
              </span>
            ))}
          </div>
        )}

        {/* Título */}
        <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors">
          {activity.title}
        </h3>

        {/* Descripción */}
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed flex-1">
          {activity.description}
        </p>

        {/* Metadatos */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-auto pt-2 border-t border-gray-100">
          {activity.audience === 'KIDS' && (
            <span className="flex items-center gap-1 text-xs text-violet-600 font-medium">
              <span>👶</span> Niños
            </span>
          )}
          {activity.audience === 'FAMILY' && (
            <span className="flex items-center gap-1 text-xs text-teal-600 font-medium">
              <span>👨‍👩‍👧</span> Familia
            </span>
          )}
          {ageLabel && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span>👧</span> {ageLabel}
            </span>
          )}
          {locationLabel && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span>📍</span> {locationLabel}
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {activity.provider && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                {activity.provider.name}
                {activity.provider.isVerified && <span className="text-indigo-500">✓</span>}
              </span>
            )}
            <FavoriteButton
              activityId={activity.id}
              initialIsFavorited={isFavorited}
              size="sm"
            />
          </span>
        </div>
      </div>
    </div>
  );

  // La tarjeta siempre enlaza a la página de detalle interna (URL canónica)
  return (
    <a href={activityPath(activity.id, activity.title)} className="block h-full">
      {cardContent}
    </a>
  );
}
