// =============================================================================
// ActivityCard — tarjeta de actividad para el grid de /actividades
// =============================================================================

import clsx from 'clsx';
import { getCategoryColor, getCategoryEmoji } from '@/lib/category-utils';

// Tipo local inferido desde lo que devuelve listActivities
// Prisma retorna price como Decimal (objeto con toNumber()), no como number primitivo
type PrismaPrice = number | { toNumber(): number } | null;

interface Activity {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  ageMin: number | null;
  ageMax: number | null;
  price: PrismaPrice;
  priceCurrency: string;
  pricePeriod: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  provider: { name: string; isVerified: boolean } | null;
  location: {
    name: string;
    neighborhood: string | null;
    city: { name: string } | null;
  } | null;
  categories: { category: { id: string; name: string; slug: string } }[];
}

interface ActivityCardProps {
  activity: Activity;
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

export default function ActivityCard({ activity }: ActivityCardProps) {
  const mainCategory = activity.categories[0]?.category;
  const bgColor = mainCategory ? getCategoryColor(mainCategory.slug) : 'bg-indigo-100';
  const categoryEmoji = mainCategory ? getCategoryEmoji(mainCategory.name) : '✨';
  const ageLabel = formatAge(activity.ageMin, activity.ageMax);
  const priceLabel = formatPrice(activity.price, activity.priceCurrency, activity.pricePeriod);
  const locationLabel = activity.location?.neighborhood ?? activity.location?.city?.name ?? '';

  const cardContent = (
    <div className="group flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden h-full">

      {/* Strip visual — siempre presente, h-20 */}
      <div className={clsx(
        'relative h-20 flex items-center justify-center overflow-hidden',
        !activity.imageUrl && bgColor,
        activity.status === 'EXPIRED' && 'opacity-60'
      )}>
        {activity.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activity.imageUrl}
            alt={activity.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-3xl select-none opacity-50">{categoryEmoji}</span>
        )}

        {/* Badge tipo */}
        <span className="absolute top-1.5 left-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-700 shadow-sm">
          {TYPE_LABELS[activity.type] ?? activity.type}
        </span>

        {/* Badge precio */}
        <span className={clsx(
          'absolute top-1.5 right-2 rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm',
          priceLabel === 'Gratis'
            ? 'bg-emerald-500 text-white'
            : priceLabel === 'No disponible'
            ? 'bg-gray-200 text-gray-500'
            : 'bg-white/90 text-gray-700'
        )}>
          {priceLabel}
        </span>

        {/* Badge expirada */}
        {activity.status === 'EXPIRED' && (
          <span className="absolute bottom-1.5 left-0 right-0 mx-auto w-fit rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
            Verificar disponibilidad
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
          {activity.provider && (
            <span className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
              {activity.provider.name}
              {activity.provider.isVerified && <span className="text-indigo-500">✓</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // La tarjeta siempre enlaza a la página de detalle interna
  return (
    <a href={`/actividades/${activity.id}`} className="block h-full">
      {cardContent}
    </a>
  );
}
