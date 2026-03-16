// =============================================================================
// ActivityCard — tarjeta de actividad para el grid de /actividades
// =============================================================================

import clsx from 'clsx';

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

// Colores de fondo para categorías (fallback si no hay imagen)
const CATEGORY_COLORS = [
  'bg-indigo-100',
  'bg-emerald-100',
  'bg-amber-100',
  'bg-rose-100',
  'bg-cyan-100',
  'bg-violet-100',
  'bg-orange-100',
  'bg-teal-100',
];

function getCategoryColor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

function formatAge(ageMin: number | null, ageMax: number | null): string {
  if (ageMin === null && ageMax === null) return '';
  if (ageMin !== null && ageMax !== null) return `${ageMin}–${ageMax} años`;
  if (ageMin !== null) return `Desde ${ageMin} años`;
  return `Hasta ${ageMax} años`;
}

function formatPrice(price: PrismaPrice, currency: string, period: string | null): string {
  if (price === null) return '';
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
  const ageLabel = formatAge(activity.ageMin, activity.ageMax);
  const priceLabel = formatPrice(activity.price, activity.priceCurrency, activity.pricePeriod);
  const locationLabel = activity.location?.neighborhood ?? activity.location?.city?.name ?? '';

  const cardContent = (
    <div className="group flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden h-full">

      {/* Imagen / placeholder de color */}
      <div className={clsx('relative h-36 flex items-center justify-center', bgColor)}>
        {activity.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activity.imageUrl}
            alt={activity.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-5xl select-none opacity-60">🎨</span>
        )}

        {/* Badge de tipo */}
        <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-700 shadow-sm">
          {TYPE_LABELS[activity.type] ?? activity.type}
        </span>

        {/* Badge de precio */}
        {priceLabel && (
          <span className={clsx(
            'absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm',
            priceLabel === 'Gratis'
              ? 'bg-emerald-500 text-white'
              : 'bg-white/90 text-gray-700'
          )}>
            {priceLabel}
          </span>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-col gap-2 p-4 flex-1">

        {/* Categorías */}
        {activity.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {activity.categories.slice(0, 3).map(({ category }) => (
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
        </div>

        {/* Proveedor */}
        {activity.provider && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-gray-400">{activity.provider.name}</span>
            {activity.provider.isVerified && (
              <span className="text-xs text-indigo-500" title="Verificado">✓</span>
            )}
          </div>
        )}
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
