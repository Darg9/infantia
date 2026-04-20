"use client";

// =============================================================================
// ActivityCard — tarjeta de actividad para el grid de /actividades
// =============================================================================

import clsx from 'clsx';
import { getCategoryGradient, getCategoryEmoji } from '@/lib/category-utils';
import { FavoriteButton } from '@/components/FavoriteButton';
import { activityPath } from '@/lib/activity-url';
import { trackEvent } from '@/lib/track';
import { normalizePrice } from '@/lib/decimal';

// Tipo local inferido desde lo que devuelve listActivities.
// En producción puede llegar como number, string o Decimal serializado.
type PrismaPrice = number | string | { toNumber?: () => number; valueOf?: () => unknown } | null;

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
  sourceDomain: string | null;
  duplicatesCount: number;
  _count?: { views: number };
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
  /**
   * compact=true → vista simplificada para el home:
   * sin badge de tipo, sin categorías, sin descripción,
   * título más prominente, footer reducido a ubicación + favorito
   */
  compact?: boolean;
}


function formatAge(ageMin: number | null, ageMax: number | null): string {
  if (ageMin === null && ageMax === null) return '';
  if (ageMin !== null && ageMax !== null) return `${ageMin}–${ageMax} años`;
  if (ageMin !== null) return `Desde ${ageMin} años`;
  return `Hasta ${ageMax} años`;
}

function formatPrice(price: PrismaPrice, currency: string, period: string | null): string {
  const numPrice = normalizePrice(price);
  if (numPrice === null) return 'No disponible';
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

export default function ActivityCard({ activity, isFavorited = false, compact = false }: ActivityCardProps) {
  const mainCategory = activity.categories[0]?.category;
  const gradient = getCategoryGradient(mainCategory?.slug ?? '');
  const categoryEmoji = mainCategory ? getCategoryEmoji(mainCategory.name) : '✨';
  const ageLabel = formatAge(activity.ageMin, activity.ageMax);
  const priceLabel = formatPrice(activity.price, activity.priceCurrency, activity.pricePeriod);
  const locationLabel = activity.location?.neighborhood ?? activity.location?.city?.name ?? '';
  const isNew = activity.status !== 'EXPIRED'
    && Date.now() - new Date(activity.createdAt).getTime() < NEW_THRESHOLD_MS;

  // ── Product Trust Signals ──
  const isFeatured = (activity.duplicatesCount ?? 0) >= 1;
  const OFFICIAL_DOMAINS = ['.gov.co', 'biblored.gov.co', 'idartes.gov.co', 'planetariodebogota.gov.co'];
  const isOfficial = OFFICIAL_DOMAINS.some(d => activity.sourceDomain?.endsWith(d));
  const isPopular = (activity._count?.views ?? 0) >= 10;

  // Resolver visibilidad de overlays prioritarios (Permitir hasta 2 si son Featured y Official)
  const shouldShowFeatured = isFeatured;
  const shouldShowOfficial = isOfficial;
  // Popular solo se muestra si no hay otros badges para no saturar 3 al mismo tiempo
  const shouldShowPopular = isPopular && !shouldShowFeatured && !shouldShowOfficial;

  const cardContent = (
    <div className="group flex flex-col rounded-2xl border border-[var(--hp-border)] bg-[var(--hp-bg-surface)] shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden h-full">

      {/* ── Strip visual ─────────────────────────────────────────────── */}
      <div
        className={clsx(
          'relative flex items-center justify-center overflow-hidden',
          compact ? 'h-24' : 'h-20',
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

        {/* Badge tipo — oculto en compact */}
        {!compact && !shouldShowFeatured && !shouldShowOfficial && !shouldShowPopular && (
          <span className="absolute top-1.5 left-2 rounded-full bg-[var(--hp-bg-surface)]/90 px-2 py-0.5 text-xs font-medium text-[var(--hp-text-primary)] shadow-sm">
            {TYPE_LABELS[activity.type] ?? activity.type}
          </span>
        )}

        {/* ── Badges de Producto (Max 2 permitidos) ── */}
        <div className="absolute top-1.5 left-2 flex gap-1 items-start max-w-[80%] flex-wrap">
          {shouldShowFeatured && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 shadow-[0_0_8px_rgba(251,191,36,0.5)] border border-amber-300">
              ⭐ Destacado
            </span>
          )}
          {shouldShowOfficial && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-900 shadow-sm border border-indigo-200">
              🛡️ Oficial
            </span>
          )}
          {shouldShowPopular && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-900 shadow-sm border border-rose-200">
              🔥 Popular
            </span>
          )}
        </div>

        {/* Badge precio */}
        {priceLabel !== 'No disponible' && (
          <span className={clsx(
            'absolute top-1.5 right-2 rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm',
            priceLabel === 'Gratis' ? 'bg-emerald-500 text-white' : 'bg-[var(--hp-bg-surface)]/90 text-[var(--hp-text-primary)]'
          )}>
            {priceLabel}
          </span>
        )}

        {/* Badge expirada */}
        {activity.status === 'EXPIRED' && (
          <span className="absolute bottom-1.5 left-0 right-0 mx-auto w-fit rounded-full bg-warning-500 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
            Verificar disponibilidad
          </span>
        )}

        {/* Badge Destacado — proveedor premium puro (se quita si isFeatured manda arriba, para no sobrecargar) */}
        {activity.provider?.isPremium && !shouldShowFeatured && (
          <span className="absolute bottom-1.5 left-2 rounded-full bg-warning-400 px-2 py-0.5 text-xs font-bold text-warning-900 shadow-sm">
            ⭐ Sponsor
          </span>
        )}

        {/* Badge Nuevo — últimos 7 días */}
        {isNew && !activity.provider?.isPremium && !shouldShowFeatured && !shouldShowOfficial && (
          <span className="absolute bottom-1.5 left-2 rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
            🆕 Nuevo
          </span>
        )}
      </div>

      {/* ── Contenido ────────────────────────────────────────────────── */}
      <div className={clsx('flex flex-col p-4 flex-1', compact ? 'gap-3' : 'gap-2')}>

        {/* Categorías — ocultas en compact */}
        {!compact && activity.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {activity.categories.slice(0, 2).map(({ category }) => (
              <span
                key={category.id}
                className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600"
              >
                {category.name}
              </span>
            ))}
          </div>
        )}

        {/* Título — más prominente en compact */}
        <h3 className={clsx(
          'leading-snug line-clamp-2 group-hover:text-brand-600 transition-colors',
          compact
            ? 'text-base font-bold text-[var(--hp-text-primary)]'
            : 'text-sm font-semibold text-[var(--hp-text-primary)]'
        )}>
          {activity.title}
        </h3>

        {/* Descripción — oculta en compact */}
        {!compact && (
          <p className="text-xs text-[var(--hp-text-secondary)] line-clamp-2 leading-relaxed flex-1">
            {activity.description}
          </p>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className={clsx(
          'flex items-center mt-auto pt-2 border-t border-[var(--hp-border)]',
          compact ? 'justify-between' : 'flex-wrap gap-x-3 gap-y-1'
        )}>

          {/* Vista completa: audience + age + location + provider */}
          {!compact && (
            <>
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
                <span className="flex items-center gap-1 text-xs text-[var(--hp-text-secondary)]">
                  <span>👧</span> {ageLabel}
                </span>
              )}
              {locationLabel && (
                <span className="flex items-center gap-1 text-xs text-[var(--hp-text-secondary)]">
                  <span>📍</span> {locationLabel}
                </span>
              )}
              <span className="ml-auto flex items-center gap-2">
                {activity.provider && (
                  <span className="flex items-center gap-1 text-xs text-[var(--hp-text-muted)]">
                    {activity.provider.name}
                    {activity.provider.isVerified && <span className="text-brand-500">✓</span>}
                  </span>
                )}
                <FavoriteButton
                  targetId={activity.id}
                  targetType="activity"
                  initialIsFavorited={isFavorited}
                  size="sm"
                />
              </span>
            </>
          )}

          {/* Vista compact: solo ubicación + favorito */}
          {compact && (
            <>
              {locationLabel ? (
                <span className="flex items-center gap-1 text-xs text-[var(--hp-text-secondary)]">
                  <span>📍</span> {locationLabel}
                </span>
              ) : (
                <span />
              )}
              <FavoriteButton
                targetId={activity.id}
                targetType="activity"
                initialIsFavorited={isFavorited}
                size="sm"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );

  // La tarjeta siempre enlaza a la página de detalle interna (URL canónica)
  return (
    <a 
      href={activityPath(activity.id, activity.title)} 
      className="block h-full"
      onClick={() => {
        trackEvent({
          type: "activity_click",
          activityId: activity.id
        });
      }}
    >
      {cardContent}
    </a>
  );
}

